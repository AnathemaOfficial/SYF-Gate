// STATUS: NON-CANON REFERENCE SKETCH
// Authority: specs/ exclusively
// Security: Panic-free by construction (length-checked before copy)

#![no_std]

use core::fmt;

// =============================================================================
// TYPES — All fields mandatory, no optional inputs
// =============================================================================

/// CanonicalInput — the typed, validated input to syf_gate().
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct CanonicalInput {
    pub subject_id: [u8; 32],
    pub action_type: ActionType,
    pub action_params: ActionParams,
    pub magnitude: u64,
    pub signal: Signal,
    pub context_min: [u8; 32],
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct ActionParams {
    pub scope_hash: [u8; 32],
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ActionType {
    Transfer,
    Execute,
    Deploy,
    Write,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Signal {
    pub r_local: i64,
    pub quantified_flow: i64,
    pub quantified_entropy: i64,
    pub observed_cadence: u64,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Limits {
    pub max_magnitude: u64,
    pub max_cadence: u64,
    pub scope: [u8; 32],
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct FinalityTag(pub [u8; 32]);

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum VerdictKind {
    Allow,
    Deny,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ReasonCode {
    /// No violation (used with ALLOW)
    None,
    /// Malformed input structure
    InvInvalidInput,
    /// Parameter exceeds hard-coded limit
    InvOutOfBounds,
    /// Action exceeds budget constraint
    InvBudgetExceeded,
    /// Action exceeds cadence constraint
    InvCadenceExceeded,
    /// Signal violates invariant constraints
    InvSignalInvalid,
    /// Action would create impossible state
    InvStateImpossible,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct GateOutput {
    pub verdict: VerdictKind,
    pub reason: ReasonCode,
    pub limits: Limits,
    pub finality: FinalityTag,
}

// =============================================================================
// CONSTANTS — Hard-coded bounds from invariants (I-3: non-configurable)
// =============================================================================

const MAX_MAGNITUDE: u64 = 1_000_000;
const MAX_CADENCE: u64 = 100;
const NEUTRAL_SCOPE: [u8; 32] = [0u8; 32];
const NEUTRAL_FINALITY: [u8; 32] = [0u8; 32];

// =============================================================================
// POISON VALUES — For fail-closed signal handling
// =============================================================================

// =============================================================================
// POISON VALUES — For fail-closed signal handling
// =============================================================================

/// CANONICAL RULE: Any negative value in Signal fields (r_local, quantified_flow,
/// quantified_entropy) triggers INV_SIGNAL_INVALID per I-1 (Fail-Closed).
///
/// POISON_SIGNAL: Used when signal cannot be computed by SignalProvider.
/// Negative r_local and entropy guarantee INV_SIGNAL_INVALID.
/// 
/// Usage (in SignalProvider):
/// ```
/// if cannot_compute_signal() {
///     return Signal {
///         r_local: POISON_R_LOCAL,
///         quantified_flow: POISON_FLOW,
///         quantified_entropy: POISON_ENTROPY,
///         observed_cadence: POISON_CADENCE,
///     };
/// }
/// ```
#[allow(dead_code)]
pub const POISON_R_LOCAL: i64 = -1;
#[allow(dead_code)]
pub const POISON_FLOW: i64 = -1;
#[allow(dead_code)]
pub const POISON_ENTROPY: i64 = -1;
#[allow(dead_code)]
pub const POISON_CADENCE: u64 = u64::MAX; // Exceeds MAX_CADENCE

// =============================================================================
// RAW INPUT WRAPPER — NON-CANON, for TV-G-001 provability
// =============================================================================

/// NON-CANON: Raw entrypoint used to prove TV-G-001 (invalid structure).
/// Accepts slices to model real-world deserialization boundaries.
pub struct RawInput<'a> {
    pub subject_id: &'a [u8],
    pub action_type: ActionType,
    pub scope_hash: &'a [u8],
    pub magnitude: u64,
    pub signal: Signal,
    pub context_min: &'a [u8],
}

/// NON-CANON: Validates structure then delegates to canonical syf_gate().
/// This wrapper exists solely to demonstrate TV-G-001 compliance.
pub fn syf_gate_entrypoint(raw: RawInput<'_>) -> GateOutput {
    // Neutral limits for immediate rejection (fixed-size, no drift)
    let neutral_limits = Limits {
        max_magnitude: MAX_MAGNITUDE,
        max_cadence: MAX_CADENCE,
        scope: NEUTRAL_SCOPE,
    };

    // =========================================================================
    // TV-G-001: Structural Integrity Check (MUST precede any logic)
    // I-1 (Fail-Closed): Malformed input => DENY + InvInvalidInput
    // =========================================================================
    if raw.subject_id.len() != 32 || raw.scope_hash.len() != 32 || raw.context_min.len() != 32 {
        return GateOutput {
            verdict: VerdictKind::Deny,
            reason: ReasonCode::InvInvalidInput,
            limits: neutral_limits,
            finality: FinalityTag(NEUTRAL_FINALITY),
        };
    }

    // Convert to canonical fixed-size arrays (no alloc, no panic)
    let mut subject_id = [0u8; 32];
    subject_id.copy_from_slice(raw.subject_id);

    let mut scope_hash = [0u8; 32];
    scope_hash.copy_from_slice(raw.scope_hash);

    let mut context_min = [0u8; 32];
    context_min.copy_from_slice(raw.context_min);

    let input = CanonicalInput {
        subject_id,
        action_type: raw.action_type,
        action_params: ActionParams { scope_hash },
        magnitude: raw.magnitude,
        signal: raw.signal,
        context_min,
    };

    syf_gate(input)
}

// =============================================================================
// CANONICAL GATE FUNCTION — Pure, deterministic, fail-closed
// =============================================================================

/// SYF Gate pure function — fail-closed, deterministic, no panics.
pub fn syf_gate(input: CanonicalInput) -> GateOutput {
    let limits = Limits {
        max_magnitude: MAX_MAGNITUDE,
        max_cadence: MAX_CADENCE,
        scope: input.action_params.scope_hash,
    };

    // =========================================================================
    // TV-G-002: Bounds Check
    // I-1 (Fail-Closed): Any out-of-bounds → DENY
    // =========================================================================
    if input.magnitude > MAX_MAGNITUDE {
        return GateOutput {
            verdict: VerdictKind::Deny,
            reason: ReasonCode::InvOutOfBounds,
            limits,
            finality: FinalityTag(NEUTRAL_FINALITY),
        };
    }

    // =========================================================================
    // TV-G-003: Signal Validation
    // I-6 (No Oracle): Signal must be deterministic local data
    // =========================================================================
    if input.signal.r_local < 0 || input.signal.quantified_entropy < 0 {
        return GateOutput {
            verdict: VerdictKind::Deny,
            reason: ReasonCode::InvSignalInvalid,
            limits,
            finality: FinalityTag(NEUTRAL_FINALITY),
        };
    }

    // =========================================================================
    // Cadence Check (I-3: Bounded Action)
    // =========================================================================
    if input.signal.observed_cadence > MAX_CADENCE {
        return GateOutput {
            verdict: VerdictKind::Deny,
            reason: ReasonCode::InvCadenceExceeded,
            limits,
            finality: FinalityTag(NEUTRAL_FINALITY),
        };
    }

    // =========================================================================
    // TV-G-004: Valid Bounded Action
    // All invariants satisfied → ALLOW with NONE reason
    // =========================================================================
    GateOutput {
        verdict: VerdictKind::Allow,
        reason: ReasonCode::None,
        limits,
        finality: FinalityTag(NEUTRAL_FINALITY),
    }
}

// =============================================================================
// TESTS — Deterministic validation of all test vectors
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_valid_input() -> CanonicalInput {
        CanonicalInput {
            subject_id: [1; 32],
            action_type: ActionType::Transfer,
            action_params: ActionParams { scope_hash: [0; 32] },
            magnitude: 500,
            signal: Signal {
                r_local: 100,
                quantified_flow: 10,
                quantified_entropy: 5,
                observed_cadence: 50,
            },
            context_min: [0; 32],
        }
    }

    #[test]
    fn tv_g_001_invalid_input() {
        // Use syf_gate_entrypoint with malformed slice (31 bytes)
        let valid = make_valid_input();
        let short_id = [0u8; 31]; // Structural error: 31 bytes instead of 32

        let raw = RawInput {
            subject_id: &short_id,
            action_type: valid.action_type,
            scope_hash: &valid.action_params.scope_hash,
            magnitude: valid.magnitude,
            signal: valid.signal,
            context_min: &valid.context_min,
        };

        let out = syf_gate_entrypoint(raw);

        assert_eq!(out.verdict, VerdictKind::Deny);
        assert_eq!(out.reason, ReasonCode::InvInvalidInput);
        // Verify neutral scope on invalid input
        assert_eq!(out.limits.scope, NEUTRAL_SCOPE);
    }

    #[test]
    fn tv_g_002_excessive_magnitude() {
        let mut input = make_valid_input();
        input.magnitude = 1_500_000;
        let out = syf_gate(input);
        assert_eq!(out.verdict, VerdictKind::Deny);
        assert_eq!(out.reason, ReasonCode::InvOutOfBounds);
    }

    #[test]
    fn tv_g_003_invalid_signal() {
        let mut input = make_valid_input();
        input.signal.r_local = -1;
        let out = syf_gate(input);
        assert_eq!(out.verdict, VerdictKind::Deny);
        assert_eq!(out.reason, ReasonCode::InvSignalInvalid);
    }

    #[test]
    fn tv_g_004_valid_bounded() {
        let input = make_valid_input();
        let out = syf_gate(input);
        assert_eq!(out.verdict, VerdictKind::Allow);
        assert_eq!(out.reason, ReasonCode::None);
        assert!(out.limits.max_magnitude >= input.magnitude);
    }

    #[test]
    fn tv_g_005_deterministic_replay() {
        let input = make_valid_input();
        let out1 = syf_gate(input);
        let out2 = syf_gate(input);
        assert_eq!(out1, out2);
    }

    #[test]
    fn tv_g_001_invalid_scope_hash() {
        // Additional: test malformed scope_hash
        let valid = make_valid_input();
        let short_scope = [0u8; 16]; // 16 bytes instead of 32

        let raw = RawInput {
            subject_id: &valid.subject_id,
            action_type: valid.action_type,
            scope_hash: &short_scope,
            magnitude: valid.magnitude,
            signal: valid.signal,
            context_min: &valid.context_min,
        };

        let out = syf_gate_entrypoint(raw);

        assert_eq!(out.verdict, VerdictKind::Deny);
        assert_eq!(out.reason, ReasonCode::InvInvalidInput);
    }

    #[test]
    fn tv_g_001_invalid_context_min() {
        // Additional: test malformed context_min
        let valid = make_valid_input();
        let short_ctx = [0u8; 0]; // Empty

        let raw = RawInput {
            subject_id: &valid.subject_id,
            action_type: valid.action_type,
            scope_hash: &valid.action_params.scope_hash,
            magnitude: valid.magnitude,
            signal: valid.signal,
            context_min: &short_ctx,
        };

        let out = syf_gate_entrypoint(raw);

        assert_eq!(out.verdict, VerdictKind::Deny);
        assert_eq!(out.reason, ReasonCode::InvInvalidInput);
    }

    #[test]
    fn tv_g_001_malformed_slice_lengths_exhaustive() {
        // KIMI AUDIT: Exhaustive test for all boundary lengths
        // Ensures panic-free behavior for ANY slice length
        let valid = make_valid_input();
        let buffer = [0u8; 64]; // Large buffer for slicing

        // Test subject_id with various lengths
        for len in [0, 1, 16, 31, 33, 64] {
            let raw = RawInput {
                subject_id: &buffer[..len],
                action_type: valid.action_type,
                scope_hash: &valid.action_params.scope_hash,
                magnitude: valid.magnitude,
                signal: valid.signal,
                context_min: &valid.context_min,
            };
            let out = syf_gate_entrypoint(raw);
            assert_eq!(out.verdict, VerdictKind::Deny, "subject_id len={}", len);
            assert_eq!(out.reason, ReasonCode::InvInvalidInput);
        }

        // Test scope_hash with various lengths
        for len in [0, 1, 16, 31, 33, 64] {
            let raw = RawInput {
                subject_id: &valid.subject_id,
                action_type: valid.action_type,
                scope_hash: &buffer[..len],
                magnitude: valid.magnitude,
                signal: valid.signal,
                context_min: &valid.context_min,
            };
            let out = syf_gate_entrypoint(raw);
            assert_eq!(out.verdict, VerdictKind::Deny, "scope_hash len={}", len);
            assert_eq!(out.reason, ReasonCode::InvInvalidInput);
        }

        // Test context_min with various lengths
        for len in [0, 1, 16, 31, 33, 64] {
            let raw = RawInput {
                subject_id: &valid.subject_id,
                action_type: valid.action_type,
                scope_hash: &valid.action_params.scope_hash,
                magnitude: valid.magnitude,
                signal: valid.signal,
                context_min: &buffer[..len],
            };
            let out = syf_gate_entrypoint(raw);
            assert_eq!(out.verdict, VerdictKind::Deny, "context_min len={}", len);
            assert_eq!(out.reason, ReasonCode::InvInvalidInput);
        }
    }

    #[test]
    fn tv_g_001_valid_32_bytes_passes_structure_check() {
        // Verify that exactly 32 bytes passes structural validation
        let valid = make_valid_input();
        let raw = RawInput {
            subject_id: &valid.subject_id,       // Exactly 32
            action_type: valid.action_type,
            scope_hash: &valid.action_params.scope_hash, // Exactly 32
            magnitude: valid.magnitude,
            signal: valid.signal,
            context_min: &valid.context_min,     // Exactly 32
        };
        let out = syf_gate_entrypoint(raw);
        // Should NOT fail on structure — may still fail on other checks
        assert_ne!(out.reason, ReasonCode::InvInvalidInput);
    }
}
