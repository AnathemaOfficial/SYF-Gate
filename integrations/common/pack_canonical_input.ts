// STATUS: NON-CANON INTEGRATION ADAPTER
// Authority: specs/SYF_GATE_INTERFACE.md
// 
// CRITICAL: This module is NO-THROW by design.
// All validation errors return { ok: false, code: ReasonCodeWire }.
// I-9 compliant: No free-form error messages.

import { ReasonCodeWire } from './reason_wire';

// =============================================================================
// TYPES
// =============================================================================

export type ActionTypeStr = "TRANSFER" | "EXECUTE" | "DEPLOY" | "WRITE";

export interface RawIntent {
  subject_id: Uint8Array;
  action_type: ActionTypeStr;
  scope_hash: Uint8Array;
  magnitude: bigint;
  context_min: Uint8Array;
}

export interface CanonicalInputPacked {
  subject_id: Uint8Array;
  action_type: number;
  action_params: { scope_hash: Uint8Array };
  magnitude: bigint;
  context_min: Uint8Array;
}

// =============================================================================
// RESULT TYPE (No-Throw Pattern)
// =============================================================================

export type PackResult =
  | { ok: true; value: CanonicalInputPacked }
  | { ok: false; code: ReasonCodeWire };

// =============================================================================
// CONSTANTS (Closed Set)
// =============================================================================

const ACTION_TYPE_MAP: Record<ActionTypeStr, number> = {
  "TRANSFER": 1,
  "EXECUTE": 2,
  "DEPLOY": 3,
  "WRITE": 4,
};

const VALID_ACTION_TYPES = new Set<string>(["TRANSFER", "EXECUTE", "DEPLOY", "WRITE"]);

// =============================================================================
// PACKER (Bijective, Fail-Closed, No-Throw)
// =============================================================================

/**
 * Packs a raw intent into CanonicalInput format.
 * 
 * NO-THROW: Returns Result type.
 * BIJECTIVE: One intent → one packed form (deterministic).
 * FAIL-CLOSED: Any validation failure → { ok: false, code }.
 * 
 * @param intent Raw intent from client
 * @returns PackResult
 */
export function packCanonicalInput(intent: RawIntent): PackResult {
  // Structural validation: subject_id must be exactly 32 bytes
  if (!intent.subject_id || intent.subject_id.length !== 32) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  // Structural validation: scope_hash must be exactly 32 bytes
  if (!intent.scope_hash || intent.scope_hash.length !== 32) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  // Structural validation: context_min must be exactly 32 bytes
  if (!intent.context_min || intent.context_min.length !== 32) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  // Type validation: action_type must be in closed set
  if (!VALID_ACTION_TYPES.has(intent.action_type)) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  // Bounds validation: magnitude must be non-negative
  if (intent.magnitude < 0n) {
    return { ok: false, code: "INV_OUT_OF_BOUNDS" };
  }

  // All validations passed — pack the input
  const packed: CanonicalInputPacked = {
    subject_id: intent.subject_id,
    action_type: ACTION_TYPE_MAP[intent.action_type],
    action_params: { scope_hash: intent.scope_hash },
    magnitude: intent.magnitude,
    context_min: intent.context_min,
  };

  return { ok: true, value: packed };
}

/**
 * Validates raw bytes without packing.
 * Useful for preflight checks.
 */
export function validateStructure(intent: Partial<RawIntent>): PackResult {
  // Delegate to packer with safe defaults for missing fields
  const safeIntent: RawIntent = {
    subject_id: intent.subject_id ?? new Uint8Array(0),
    action_type: intent.action_type ?? ("INVALID" as ActionTypeStr),
    scope_hash: intent.scope_hash ?? new Uint8Array(0),
    magnitude: intent.magnitude ?? 0n,
    context_min: intent.context_min ?? new Uint8Array(0),
  };
  
  return packCanonicalInput(safeIntent);
}
