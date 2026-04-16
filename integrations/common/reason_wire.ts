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
 * HTTP status mapping.
 *
 * Audit 2026-04-16 (G-ORACLE): differentiated HTTP statuses (400/402/409/429)
 * exposed the denial reason to the caller, creating a 5-value oracle that
 * enables boundary probing. This violates I-7 (Silence) from the canonical
 * Book of SYF — the external wire must be binary (ALLOW / IMPOSSIBLE) with
 * no semantic leak.
 *
 * Fix: ALL denies now return HTTP 200. The verdict is carried in the JSON
 * body as a single opaque marker ("IMPOSSIBLE"). Internal reason codes
 * stay in server-side audit logs only — they never reach the network wire.
 *
 * Trusted operator tooling can still read reason codes from audit logs.
 * Agents on the network see only: ALLOW (with effect) or IMPOSSIBLE (silent).
 */
export const HTTP_STATUS_MAP: Record<ReasonCodeWire, number> = {
  "NONE": 200,
  "INV_INVALID_INPUT": 200,
  "INV_OUT_OF_BOUNDS": 200,
  "INV_BUDGET_EXCEEDED": 200,
  "INV_CADENCE_EXCEEDED": 200,
  "INV_SIGNAL_INVALID": 200,
  "INV_STATE_IMPOSSIBLE": 200,
};

/**
 * Canonical JSON response body — BINARY ONLY.
 *
 * Audit 2026-04-16 (G-ORACLE): the prior shape `{"verdict":"DENY","code":...}`
 * leaked denial reason codes to the caller. The canonical binary membrane
 * (per SLIME-Core and the Book of SYF I-7 Silence) allows only:
 *   - AUTHORIZED (action proceeds to effect)
 *   - IMPOSSIBLE (no action, no explanation)
 *
 * Internal reason codes remain available via audit logs and operator
 * telemetry. They are NEVER emitted over the network wire.
 */
export interface GateResponseWire {
  verdict: VerdictWire;
}

export type VerdictWireExternal = "AUTHORIZED" | "IMPOSSIBLE";

export function buildResponseBody(
  verdict: VerdictWire,
  _reason: ReasonCodeWire
): GateResponseWire {
  if (verdict === "ALLOW") {
    return { verdict: "ALLOW" };
  }
  // I-7 Silence: all denies collapse to the same opaque marker.
  return { verdict: "DENY" };
}

/**
 * Convert the internal ALLOW/DENY to the canonical external AUTHORIZED/IMPOSSIBLE
 * wire form per SLIME-Core membrane semantics.
 *
 * Kept as a helper for integrators that want the SLIME-Core-shaped output
 * directly; the middleware still emits the verdict/code-less DENY shape for
 * backward compatibility with existing Gate consumers.
 */
export function toExternalVerdict(verdict: VerdictWire): VerdictWireExternal {
  return verdict === "ALLOW" ? "AUTHORIZED" : "IMPOSSIBLE";
}
