// STATUS: NON-CANON INTEGRATION ADAPTER
// Authority: specs/ (Gate behavior), reason_map.md (HTTP mapping)
// Security: TRUSTED — Server-Side Enforcement Layer
//
// This middleware is the SOLE source of truth for Gate enforcement.
// Preflight layers are UNTRUSTED and may be bypassed by attackers.

import { 
  packCanonicalInput, 
  PackResult,
  RawIntent 
} from '../common/pack_canonical_input';
import { 
  toReasonWire, 
  toVerdictWire,
  HTTP_STATUS_MAP,
  buildResponseBody,
  ReasonCodeWire 
} from '../common/reason_wire';
import { 
  computeSignalP0, 
  recordAction,
  POISON_SIGNAL 
} from './signal_provider_p0';

// =============================================================================
// TYPES
// =============================================================================

// Minimal request/response types (framework-agnostic)
interface EnforceRequest {
  body: RawIntent;
}

interface EnforceResponse {
  status: (code: number) => EnforceResponse;
  json: (body: unknown) => void;
}

type NextFunction = () => void | Promise<void>;

// =============================================================================
// GATE KERNEL INTERFACE
// =============================================================================

// Import from WASM build or native binding
// In production: import { syf_gate } from '../ref/syf_gate_wasm';

interface GateInput {
  subject_id: Uint8Array;
  action_type: number;
  action_params: { scope_hash: Uint8Array };
  magnitude: bigint;
  signal: {
    r_local: bigint;
    quantified_flow: bigint;
    quantified_entropy: bigint;
    observed_cadence: bigint;
  };
  context_min: Uint8Array;
}

interface GateOutput {
  verdict: string;  // "Allow" | "Deny"
  reason: string;   // Rust enum variant name
}

// Placeholder: Replace with actual WASM/native import
declare function syf_gate(input: GateInput): GateOutput;

// =============================================================================
// ENFORCEMENT MIDDLEWARE (Mute, Fail-Closed)
// =============================================================================

/**
 * SYF Gate Enforcement Middleware.
 * 
 * MUTE: Responses contain only verdict + closed-set reason code.
 * FAIL-CLOSED: Any error → DENY + INV_INVALID_INPUT.
 * TRUSTED: Uses server-side signal provider (not client data).
 * 
 * @param req Request with body containing RawIntent
 * @param res Response object
 * @param next Next middleware (called only on ALLOW)
 */
export async function syfGateEnforcer(
  req: EnforceRequest,
  res: EnforceResponse,
  next: NextFunction
): Promise<void> {
  
  // Step 1: Pack input (no-throw)
  const packResult: PackResult = packCanonicalInput(req.body);
  
  if (!packResult.ok) {
    // Structural validation failed
    const wireCode = packResult.code;
    const httpStatus = HTTP_STATUS_MAP[wireCode];
    const body = buildResponseBody("DENY", wireCode);
    res.status(httpStatus).json(body);
    return;
  }

  const packed = packResult.value;

  // Step 2: Compute signal from TRUSTED state (server-only)
  const signal = computeSignalP0(packed.subject_id);
  
  // Step 3: Call Gate kernel
  const gateInput: GateInput = {
    subject_id: packed.subject_id,
    action_type: packed.action_type,
    action_params: packed.action_params,
    magnitude: packed.magnitude,
    signal: {
      r_local: signal.r_local,
      quantified_flow: signal.quantified_flow,
      quantified_entropy: signal.quantified_entropy,
      observed_cadence: signal.observed_cadence,
    },
    context_min: packed.context_min,
  };

  let gateOutput: GateOutput;
  try {
    gateOutput = syf_gate(gateInput);
  } catch {
    // Gate threw (should never happen with panic-free impl)
    // Fail-closed: treat as state impossible
    const body = buildResponseBody("DENY", "INV_STATE_IMPOSSIBLE");
    res.status(409).json(body);
    return;
  }

  // Step 4: Map to wire format
  const verdictWire = toVerdictWire(gateOutput.verdict);
  const reasonWire = toReasonWire(gateOutput.reason);

  // Step 5: Branch on verdict
  if (verdictWire === "ALLOW") {
    // Record action in trusted state (post-ALLOW)
    recordAction(packed.subject_id, packed.magnitude);
    
    // Proceed to next middleware / handler
    await next();
    return;
  }

  // DENY path: return mute response
  const httpStatus = HTTP_STATUS_MAP[reasonWire];
  const body = buildResponseBody("DENY", reasonWire);
  res.status(httpStatus).json(body);
}

/**
 * Express-style error handler for Gate enforcement.
 * Catches any unhandled errors and returns fail-closed response.
 */
export function gateErrorHandler(
  _err: unknown,
  _req: EnforceRequest,
  res: EnforceResponse,
  _next: NextFunction
): void {
  // Fail-closed: unknown error → DENY
  const body = buildResponseBody("DENY", "INV_STATE_IMPOSSIBLE");
  res.status(409).json(body);
}
