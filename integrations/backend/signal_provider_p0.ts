// STATUS: NON-CANON INTEGRATION ADAPTER
// Authority: docs/SIGNAL_PROVIDER_SPEC.md
// Security: TRUSTED — Server-Side Only
//
// ⚠️ WARNING: This module MUST NOT be imported by client-side code.
// ⚠️ WARNING: This module MUST NOT be imported by UNTRUSTED preflight layers.
//
// All state (counters, budgets) resides in the trusted enforcement layer.
// Any signal computed from client-provided state is UNTRUSTED POISON.

// =============================================================================
// TYPES
// =============================================================================

export interface SignalP0 {
  r_local: bigint;
  quantified_flow: bigint;
  quantified_entropy: bigint;
  observed_cadence: bigint;
}

/**
 * POISON_SIGNAL — Used when signal cannot be computed.
 * 
 * Per I-1 (Fail-Closed): If any field cannot be computed,
 * Signal is invalid → Gate MUST return DENY.
 * 
 * Negative values guarantee INV_SIGNAL_INVALID from Gate.
 */
export const POISON_SIGNAL: SignalP0 = {
  r_local: -1n,
  quantified_flow: -1n,
  quantified_entropy: -1n,
  observed_cadence: BigInt(Number.MAX_SAFE_INTEGER), // Exceeds MAX_CADENCE
};

// =============================================================================
// TRUSTED STATE (Server-Only)
// =============================================================================

// In production: Replace with database/Redis/persistent store
// This in-memory map is for demonstration only.

interface SubjectState {
  action_count: bigint;      // Total actions (infinite window)
  budget_remaining: bigint;  // Remaining budget
}

const TRUSTED_STATE = new Map<string, SubjectState>();

// Default budget per subject (hard-coded, non-configurable per I-3)
const DEFAULT_BUDGET: bigint = 1_000_000n;

// =============================================================================
// P0 SIGNAL PROVIDER (Deterministic, No Oracle)
// =============================================================================

/**
 * Computes Signal using P0 rules.
 * 
 * P0 Rules (from SIGNAL_PROVIDER_SPEC.md):
 * - observed_cadence = counter[subject_id] (strictly local, infinite window)
 * - quantified_flow = budget_remaining (mechanical decrement)
 * - quantified_entropy = 0 (NEUTRAL, no volatility measurement)
 * - r_local = 1 (PLACEHOLDER, invariant)
 * 
 * @param subjectId 32-byte subject identifier
 * @returns SignalP0 or POISON_SIGNAL on failure
 */
export function computeSignalP0(subjectId: Uint8Array): SignalP0 {
  // Structural validation
  if (!subjectId || subjectId.length !== 32) {
    return POISON_SIGNAL;
  }

  const key = Buffer.from(subjectId).toString("hex");
  
  // Get or initialize subject state
  let state = TRUSTED_STATE.get(key);
  if (!state) {
    state = {
      action_count: 0n,
      budget_remaining: DEFAULT_BUDGET,
    };
    TRUSTED_STATE.set(key, state);
  }

  // Compute signal (deterministic, local-only)
  return {
    r_local: 1n,                           // P0: Placeholder invariant
    quantified_flow: state.budget_remaining,
    quantified_entropy: 0n,                // P0: Neutral
    observed_cadence: state.action_count,
  };
}

/**
 * Increments action counter for subject.
 * Called AFTER successful Gate ALLOW + execution.
 * 
 * @param subjectId 32-byte subject identifier
 * @param cost Amount to deduct from budget
 */
export function recordAction(subjectId: Uint8Array, cost: bigint): void {
  if (!subjectId || subjectId.length !== 32) return;
  
  const key = Buffer.from(subjectId).toString("hex");
  const state = TRUSTED_STATE.get(key);
  
  if (state) {
    state.action_count += 1n;
    state.budget_remaining = state.budget_remaining > cost 
      ? state.budget_remaining - cost 
      : 0n;
  }
}

/**
 * Resets subject state.
 * Administrative function — NOT called during normal operation.
 */
export function resetSubject(subjectId: Uint8Array): void {
  if (!subjectId || subjectId.length !== 32) return;
  
  const key = Buffer.from(subjectId).toString("hex");
  TRUSTED_STATE.delete(key);
}

// =============================================================================
// INVARIANTS
// =============================================================================

// I-4 (Determinism): Same subjectId → same signal (given same state)
// I-6 (No Oracle): No external queries, no time APIs, no RNG
// I-3 (Bounded): Budget and cadence are bounded by hard-coded constants
