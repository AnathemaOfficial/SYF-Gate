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
  /**
   * Optional Express/Fastify-style indicator that the response has already
   * been sent. When present and truthy, the error handler MUST NOT try to
   * write a new body (avoids double-fault / headers-already-sent crashes).
   */
  headersSent?: boolean;
}

type NextFunction = () => void | Promise<void>;

/**
 * Render a byte array as lowercase hex for structured logs.
 * Keeps logs greppable without depending on Node's `Buffer` (browser-safe).
 */
function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += (b < 16 ? "0" : "") + b.toString(16);
  }
  return out;
}

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
 * BINARY: Responses carry only `{ verdict: "ALLOW" | "DENY" }` — no reason
 *   code on the wire per Book of SYF I-7 (Silence). Reason codes remain
 *   available in server-side audit logs via `reason_wire.ts` mappings.
 * UNIFORM STATUS: All verdicts (ALLOW and every DENY path, including
 *   `INV_STATE_IMPOSSIBLE`) return HTTP 200 — no status oracle.
 * FAIL-CLOSED: Any unexpected error → DENY with no semantic hint.
 * TRUSTED: Uses server-side signal provider (not client data).
 *
 * @param req Request with body containing RawIntent
 * @param res Response object (may expose `headersSent` for post-response guards)
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

  // Step 2: Compute signal from TRUSTED state (server-only).
  // `computeSignalP0` is async since the store refactor — it serialises
  // per-subject operations so a concurrent `recordAction` cannot race.
  const signal = await computeSignalP0(packed.subject_id);

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
    // Fail-closed: treat as state impossible.
    //
    // Codex verification 2026-04-16 (residual G-ORACLE): the HTTP status
    // was hard-coded to 409 here, creating a 2-class oracle alongside the
    // canonical 200 deny path. Now uses `HTTP_STATUS_MAP` so the external
    // wire stays uniformly 200 per I-7 (Silence).
    const body = buildResponseBody("DENY", "INV_STATE_IMPOSSIBLE");
    res.status(HTTP_STATUS_MAP["INV_STATE_IMPOSSIBLE"]).json(body);
    return;
  }

  // Step 4: Map to wire format
  const verdictWire = toVerdictWire(gateOutput.verdict);
  const reasonWire = toReasonWire(gateOutput.reason);

  // Step 5: Branch on verdict
  if (verdictWire === "ALLOW") {
    // Budget is only consumed on CONFIRMED execution, never on Gate verdict
    // alone. Previously `recordAction` ran before `next()` — meaning a
    // handler that threw still drained budget, and a replaced Gate stub that
    // always returned ALLOW could drain real budget. We now wrap `next()` in
    // try/finally and only call `recordAction` once the downstream handler
    // returned without throwing. This addresses audit finding H-2.
    //
    // Audit 2026-04-16 (G-RECORD): `recordAction` failure was silently
    // swallowed. If the store is down, the downstream handler succeeded but
    // the budget was never debited — a "free action" bug. We now propagate
    // `recordAction` failures as exceptions so the error is observable to
    // the surrounding framework (error middleware, process-level uncaught
    // handler, or telemetry). The downstream side effect still happened;
    // what we protect is that the anomaly is NOT silently absorbed.
    //
    // Proper fix (follow-up): replace post-hoc `recordAction` with a
    // reserve-then-finalize pattern — decrement budget BEFORE `next()` and
    // release the reservation if `next()` throws. That pattern closes the
    // window completely (the side effect cannot happen without a prior
    // reservation). See signal_provider_p0.ts for the planned refactor.
    let nextThrew = false;
    try {
      await next();
    } catch (err) {
      nextThrew = true;
      throw err;
    }
    if (!nextThrew) {
      try {
        await recordAction(packed.subject_id, packed.magnitude);
      } catch (recordErr) {
        // Budget accounting failure after successful side-effect.
        // The downstream handler already wrote its response, so we cannot
        // send a different HTTP body. Propagate the error so surrounding
        // infrastructure (error middleware, observability) sees it —
        // never silently swallow.
        //
        // Codex verification 2026-04-16: framework capture of async
        // rejections is host-dependent (Express 4 direct middleware does
        // not reliably propagate them). A structured log before the throw
        // is the only LOCAL guarantee that operators see the anomaly,
        // regardless of whether the host error boundary catches it.
        /* eslint-disable no-console */
        console.error(
          JSON.stringify({
            event: "gate_record_action_failed",
            severity: "critical",
            subject_id: bytesToHex(packed.subject_id),
            magnitude: packed.magnitude.toString(),
            error: recordErr instanceof Error ? recordErr.message : String(recordErr),
            note:
              "Side-effect committed but budget not debited. " +
              "Investigate store availability. Follow-up: reserve-then-finalize.",
          }),
        );
        /* eslint-enable no-console */
        throw recordErr;
      }
    }
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
 *
 * Codex verification 2026-04-16: two changes from the prior version.
 *
 * 1. Residual G-ORACLE: status was hard-coded to 409, creating a 2-class
 *    oracle with the canonical 200 deny path. Now uses `HTTP_STATUS_MAP`
 *    so every external deny is uniformly HTTP 200.
 *
 * 2. Post-response safety for the G-RECORD fix: when `recordAction()`
 *    fails AFTER the downstream handler has already sent its response,
 *    the error is thrown from `syfGateEnforcer` and lands here — but
 *    the response is already committed. Writing a second body would
 *    crash with "headers already sent". We now check `headersSent`
 *    defensively and log-only in that case; operators see the anomaly
 *    via the structured log emitted earlier by `syfGateEnforcer`.
 */
export function gateErrorHandler(
  err: unknown,
  _req: EnforceRequest,
  res: EnforceResponse,
  _next: NextFunction
): void {
  if (res.headersSent === true) {
    // Downstream handler already wrote a response. Cannot safely overwrite.
    // The anomaly was already logged at the throw site; this handler is
    // a no-op in the post-response failure mode.
    /* eslint-disable no-console */
    console.error(
      JSON.stringify({
        event: "gate_error_handler_post_response",
        severity: "warning",
        error: err instanceof Error ? err.message : String(err),
        note:
          "Response already sent when error reached gateErrorHandler; " +
          "no response rewrite attempted. See preceding event for details.",
      }),
    );
    /* eslint-enable no-console */
    return;
  }
  // Fail-closed: unknown error → DENY (no reason code on the wire).
  const body = buildResponseBody("DENY", "INV_STATE_IMPOSSIBLE");
  res.status(HTTP_STATUS_MAP["INV_STATE_IMPOSSIBLE"]).json(body);
}
