// STATUS: NON-CANON INTEGRATION ADAPTER
// Authority: specs/SYF_GATE_INTERFACE.md (ReasonCodes closed set)
// Version: 1.0 — No modifications permitted without re-audit.

/**
 * ReasonCodeWire — Canonical wire format for reason codes.
 * 
 * This is the ONLY valid representation for JSON/HTTP output.
 * Internal enums (Rust/Python/TS) MUST be mapped through this table.
 */
export type ReasonCodeWire =
  | "NONE"
  | "INV_INVALID_INPUT"
  | "INV_OUT_OF_BOUNDS"
  | "INV_BUDGET_EXCEEDED"
  | "INV_CADENCE_EXCEEDED"
  | "INV_SIGNAL_INVALID"
  | "INV_STATE_IMPOSSIBLE";

/**
 * VerdictWire — Canonical wire format for verdicts.
 */
export type VerdictWire = "ALLOW" | "DENY";

/**
 * Maps internal Rust-style enum names to canonical wire format.
 * EXHAUSTIVE — unknown codes map to INV_STATE_IMPOSSIBLE (fail-closed).
 */
const REASON_CODE_MAP: Record<string, ReasonCodeWire> = {
  // Rust enum variants (PascalCase)
  "None": "NONE",
  "InvInvalidInput": "INV_INVALID_INPUT",
  "InvOutOfBounds": "INV_OUT_OF_BOUNDS",
  "InvBudgetExceeded": "INV_BUDGET_EXCEEDED",
  "InvCadenceExceeded": "INV_CADENCE_EXCEEDED",
  "InvSignalInvalid": "INV_SIGNAL_INVALID",
  "InvStateImpossible": "INV_STATE_IMPOSSIBLE",
  
  // Python enum variants (SCREAMING_SNAKE)
  "NONE": "NONE",
  "INV_INVALID_INPUT": "INV_INVALID_INPUT",
  "INV_OUT_OF_BOUNDS": "INV_OUT_OF_BOUNDS",
  "INV_BUDGET_EXCEEDED": "INV_BUDGET_EXCEEDED",
  "INV_CADENCE_EXCEEDED": "INV_CADENCE_EXCEEDED",
  "INV_SIGNAL_INVALID": "INV_SIGNAL_INVALID",
  "INV_STATE_IMPOSSIBLE": "INV_STATE_IMPOSSIBLE",
};

/**
 * Converts any internal reason code to canonical wire format.
 * Fail-closed: unknown → INV_STATE_IMPOSSIBLE
 */
export function toReasonWire(internal: string): ReasonCodeWire {
  return REASON_CODE_MAP[internal] ?? "INV_STATE_IMPOSSIBLE";
}

/**
 * Converts internal verdict to wire format.
 */
export function toVerdictWire(internal: string): VerdictWire {
  if (internal === "Allow" || internal === "ALLOW") return "ALLOW";
  return "DENY"; // Fail-closed
}

/**
 * HTTP status mapping (closed set).
 * Per specs: No custom status codes.
 */
export const HTTP_STATUS_MAP: Record<ReasonCodeWire, number> = {
  "NONE": 200,
  "INV_INVALID_INPUT": 400,
  "INV_OUT_OF_BOUNDS": 400,
  "INV_BUDGET_EXCEEDED": 402,
  "INV_CADENCE_EXCEEDED": 429,
  "INV_SIGNAL_INVALID": 400,
  "INV_STATE_IMPOSSIBLE": 409,
};

/**
 * Builds canonical JSON response body.
 * I-9 compliant: No narrative, no free text.
 */
export interface GateResponseWire {
  verdict: VerdictWire;
  code?: ReasonCodeWire; // Only present on DENY
}

export function buildResponseBody(
  verdict: VerdictWire,
  reason: ReasonCodeWire
): GateResponseWire {
  if (verdict === "ALLOW") {
    return { verdict: "ALLOW" };
  }
  return { verdict: "DENY", code: reason };
}
