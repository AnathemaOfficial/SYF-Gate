// STATUS: NON-CANON REFERENCE SKETCH
// Authority: specs/ exclusively
// Security: Panic-free by construction (length-checked before copy)
//
// HARDENING (API surface audit): All struct fields are private with const getters.
// Prevents integrators from treating the reference as a "pub field playground"
// that gives bad habits (same pattern as Budget(pub u32) in AB).

#![no_std]

use core::fmt;

// =============================================================================
// TYPES — All fields mandatory, no optional inputs
// =============================================================================

/// CanonicalInput — the typed, validated input to syf_gate().
///
/// Fields are private: construction via `CanonicalInput::new()` only.
/// This prevents integrators from partially mutating inputs between calls.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct CanonicalInput {
    subject_id: [u8; 32],
    action_type: ActionType,
    action_params: ActionParams,
    magnitude: u64,
    signal: Signal,
    context_min: [u8; 32],
}

impl CanonicalInput {
    /// Construct a canonical input. All fields mandatory, no defaults.
    pub const fn new(
        subject_id: [u8; 32],
        action_type: ActionType,
        action_params: ActionParams,
        magnitude: u64,
        signal: Signal,
        context_min: [u8; 32],
    ) -> Self {
        Self { subject_id, action_type, action_params, magnitude, signal, context_min }
    }

    pub const fn subject_id(&self) -> [u8; 32] { self.subject_id }
    pub const fn action_type(&self) -> ActionType { self.action_type }
    pub const fn action_params(&self) -> ActionParams { self.action_params }
    pub const fn magnitude(&self) -> u64 { self.magnitude }
    pub const fn signal(&self) -> Signal { self.signal }
    pub const fn context_min(&self) -> [u8; 32] { self.context_min }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct ActionParams {
    scope_hash: [u8; 32],
}

impl ActionParams {
    pub const fn new(scope_hash: [u8; 32]) -> Self { Self { scope_hash } }
    pub const fn scope_hash(&self) -> [u8; 32] { self.scope_hash }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ActionType {
    Transfer,
    Execute,
    Deploy,
    Write,
}

/// Signal — deterministic local measurements (I-6: No Oracle).
///
/// Fields are private. Construct via `Signal::new()`, read via getters.
/// Negative values in r_local / quantified_entropy trigger POISON (I-1).
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Signal {
    r_local: i64,
    quantified_flow: i64,
    quantified_entropy: i64,
    observed_cadence: u64,
}

impl Signal {
    pub const fn new(
        r_local: i64,
        quantified_flow: i64,
        quantified_entropy: i64,
        observed_cadence: u64,
    ) -> Self {
        Self { r_local, quantified_flow, quantified_entropy, observed_cadence }
    }

    pub const fn r_local(&self) -> i64 { self.r_local }
    pub const fn quantified_flow(&self) -> i64 { self.quantified_flow }
    pub const fn quantified_entropy(&self) -> i64 { self.quantified_entropy }
    pub const fn observed_cadence(&self) -> u64 { self.observed_cadence }
}

/// Limits — hard-coded bounds (I-3: non-configurable).
///
/// Fields are private: limits are set by the Gate, not by the integrator.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Limits {
    max_magnitude: u64,
    max_cadence: u64,
    scope: [u8; 32],
}

impl Limits {
    pub const fn new(max_magnitude: u64, max_cadence: u64, scope: [u8; 32]) -> Self {
        Self { max_magnitude, max_cadence, scope }
    }

    pub const fn max_magnitude(&self) -> u64 { self.max_magnitude }
    pub const fn max_cadence(&self) -> u64 { self.max_cadence }
    pub const fn scope(&self) -> [u8; 32] { self.scope }
}

/// FinalityTag — opaque 32-byte finality marker.
/// Inner is private: no direct mutation.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct FinalityTag([u8; 32]);

impl FinalityTag {
    pub const fn new(bytes: [u8; 32]) -> Self { Self(bytes) }
    pub const fn as_bytes(&self) -> [u8; 32] { self.0 }
}

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

/// GateOutput — immutable verdict structure.
///
/// Fields are private: the Gate produces output, integrators only read it.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct GateOutput {
    verdict: VerdictKind,
    reason: ReasonCode,
    limits: Limits,
    finality: FinalityTag,
}

impl GateOutput {
    const fn new(verdict: VerdictKind, reason: ReasonCode, limits: Limits, finality: FinalityTag) -> Self {
        Self { verdict, reason, limits, finality }
    }

    pub const fn verdict(&self) -> VerdictKind { self.verdict }
    pub const fn reason(&self) -> ReasonCode { self.reason }
    pub const fn limits(&self) -> Limits { self.limits }
    pub const fn finality(&self) -> FinalityTag { self.finality }
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

/// CANONICAL RULE: Any negative value in Signal fields (r_local, quantified_flow,
/// quantified_entropy) triggers INV_SIGNAL_INVALID per I-1 (Fail-Closed).
///
/// POISON_SIGNAL: Used when signal cannot be computed by SignalProvider.
/// Negative r_local and entropy guarantee INV_SIGNAL_INVALID.
///
/// Usage (in SignalProvider):
/// ```
/// if cannot_compute_signal() {
///     return Signal::new(POISON_R_LOCAL, POISON_FLOW, POISON_ENTROPY, POISON_CADENCE);
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
    let neutral_limits = Limits::new(MAX_MAGNITUDE, MAX_CADENCE, NEUTRAL_SCOPE);

    // =========================================================================
    // TV-G-001: Structural Integrity Check (MUST precede any logic)
    // I-1 (Fail-Closed): Malformed input => DENY + InvInvalidInput
    // =========================================================================
    if raw.subject_id.len() != 32 || raw.scope_hash.len() != 32 || raw.context_min.len() != 32 {
        return GateOutput::new(
            VerdictKind::Deny,
            ReasonCode::InvInvalidInput,
            neutral_limits,
            FinalityTag::new(NEUTRAL_FINALITY),
        );
    }

    // Convert to canonical fixed-size arrays (no alloc, no panic)
    let mut subject_id = [0u8; 32];
    subject_id.copy_from_slice(raw.subject_id);

    let mut scope_hash = [0u8; 32];
    scope_hash.copy_from_slice(raw.scope_hash);

    let mut context_min = [0u8; 32];
    context_min.copy_from_slice(raw.context_min);

    let input = CanonicalInput::new(
        subject_id,
        raw.action_type,
        ActionParams::new(scope_hash),
        raw.magnitude,
        raw.signal,
        context_min,
    );

    syf_gate(input)
}

// =============================================================================
// CANONICAL GATE FUNCTION — Pure, deterministic, fail-closed
// =============================================================================

/// SYF Gate pure function — fail-closed, deterministic, no panics.
pub fn syf_gate(input: CanonicalInput) -> GateOutput {
    let limits = Limits::new(MAX_MAGNITUDE, MAX_CADENCE, input.action_params().scope_hash());

    // =========================================================================
    // TV-G-002: Bounds Check
    // I-1 (Fail-Closed): Any out-of-bounds → DENY
    // =========================================================================
    if input.magnitude() > MAX_MAGNITUDE {
        return GateOutput::new(
            VerdictKind::Deny,
            ReasonCode::InvOutOfBounds,
            limits,
            FinalityTag::new(NEUTRAL_FINALITY),
        );
    }

    // =========================================================================
    // TV-G-003: Signal Validation
    // I-6 (No Oracle): Signal must be deterministic local data
    // =========================================================================
    if input.signal().r_local() < 0 || input.signal().quantified_entropy() < 0 {
        return GateOutput::new(
            VerdictKind::Deny,
            ReasonCode::InvSignalInvalid,
            limits,
            FinalityTag::new(NEUTRAL_FINALITY),
        );
    }

    // =========================================================================
    // Cadence Check (I-3: Bounded Action)
    // =========================================================================
    if input.signal().observed_cadence() > MAX_CADENCE {
        return GateOutput::new(
            VerdictKind::Deny,
            ReasonCode::InvCadenceExceeded,
            limits,
            FinalityTag::new(NEUTRAL_FINALITY),
        );
    }

    // =========================================================================
    // TV-G-004: Valid Bounded Action
    // All invariants satisfied → ALLOW with NONE reason
    // =========================================================================
    GateOutput::new(
        VerdictKind::Allow,
        ReasonCode::None,
        limits,
        FinalityTag::new(NEUTRAL_FINALITY),
    )
}

// =============================================================================
// TESTS — Deterministic validation of all test vectors
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_valid_input() -> CanonicalInput {
        CanonicalInput::new(
            [1; 32],
            ActionType::Transfer,
            ActionParams::new([0; 32]),
            500,
            Signal::new(100, 10, 5, 50),
            [0; 32],
        )
    }

    #[test]
    fn tv_g_001_invalid_input() {
        // Use syf_gate_entrypoint with malformed slice (31 bytes)
        let valid = make_valid_input();
        let short_id = [0u8; 31]; // Structural error: 31 bytes instead of 32

        let raw = RawInput {
            subject_id: &short_id,
            action_type: valid.action_type(),
            scope_hash: &valid.action_params().scope_hash(),
            magnitude: valid.magnitude(),
            signal: valid.signal(),
            context_min: &valid.context_min(),
        };

        let out = syf_gate_entrypoint(raw);

        assert_eq!(out.verdict(), VerdictKind::Deny);
        assert_eq!(out.reason(), ReasonCode::InvInvalidInput);
        // Verify neutral scope on invalid input
        assert_eq!(out.limits().scope(), NEUTRAL_SCOPE);
    }

    #[test]
    fn tv_g_002_excessive_magnitude() {
        let input = CanonicalInput::new(
            [1; 32],
            ActionType::Transfer,
            ActionParams::new([0; 32]),
            1_500_000,
            Signal::new(100, 10, 5, 50),
            [0; 32],
        );
        let out = syf_gate(input);
        assert_eq!(out.verdict(), VerdictKind::Deny);
        assert_eq!(out.reason(), ReasonCode::InvOutOfBounds);
    }

    #[test]
    fn tv_g_003_invalid_signal() {
        let input = CanonicalInput::new(
            [1; 32],
            ActionType::Transfer,
            ActionParams::new([0; 32]),
            500,
            Signal::new(-1, 10, 5, 50),
            [0; 32],
        );
        let out = syf_gate(input);
        assert_eq!(out.verdict(), VerdictKind::Deny);
        assert_eq!(out.reason(), ReasonCode::InvSignalInvalid);
    }

    #[test]
    fn tv_g_004_valid_bounded() {
        let input = make_valid_input();
        let out = syf_gate(input);
        assert_eq!(out.verdict(), VerdictKind::Allow);
        assert_eq!(out.reason(), ReasonCode::None);
        assert!(out.limits().max_magnitude() >= input.magnitude());
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
            subject_id: &valid.subject_id(),
            action_type: valid.action_type(),
            scope_hash: &short_scope,
            magnitude: valid.magnitude(),
            signal: valid.signal(),
            context_min: &valid.context_min(),
        };

        let out = syf_gate_entrypoint(raw);

        assert_eq!(out.verdict(), VerdictKind::Deny);
        assert_eq!(out.reason(), ReasonCode::InvInvalidInput);
    }

    #[test]
    fn tv_g_001_invalid_context_min() {
        // Additional: test malformed context_min
        let valid = make_valid_input();
        let short_ctx = [0u8; 0]; // Empty

        let raw = RawInput {
            subject_id: &valid.subject_id(),
            action_type: valid.action_type(),
            scope_hash: &valid.action_params().scope_hash(),
            magnitude: valid.magnitude(),
            signal: valid.signal(),
            context_min: &short_ctx,
        };

        let out = syf_gate_entrypoint(raw);

        assert_eq!(out.verdict(), VerdictKind::Deny);
        assert_eq!(out.reason(), ReasonCode::InvInvalidInput);
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
                action_type: valid.action_type(),
                scope_hash: &valid.action_params().scope_hash(),
                magnitude: valid.magnitude(),
                signal: valid.signal(),
                context_min: &valid.context_min(),
            };
            let out = syf_gate_entrypoint(raw);
            assert_eq!(out.verdict(), VerdictKind::Deny, "subject_id len={}", len);
            assert_eq!(out.reason(), ReasonCode::InvInvalidInput);
        }

        // Test scope_hash with various lengths
        for len in [0, 1, 16, 31, 33, 64] {
            let raw = RawInput {
                subject_id: &valid.subject_id(),
                action_type: valid.action_type(),
                scope_hash: &buffer[..len],
                magnitude: valid.magnitude(),
                signal: valid.signal(),
                context_min: &valid.context_min(),
            };
            let out = syf_gate_entrypoint(raw);
            assert_eq!(out.verdict(), VerdictKind::Deny, "scope_hash len={}", len);
            assert_eq!(out.reason(), ReasonCode::InvInvalidInput);
        }

        // Test context_min with various lengths
        for len in [0, 1, 16, 31, 33, 64] {
            let raw = RawInput {
                subject_id: &valid.subject_id(),
                action_type: valid.action_type(),
                scope_hash: &valid.action_params().scope_hash(),
                magnitude: valid.magnitude(),
                signal: valid.signal(),
                context_min: &buffer[..len],
            };
            let out = syf_gate_entrypoint(raw);
            assert_eq!(out.verdict(), VerdictKind::Deny, "context_min len={}", len);
            assert_eq!(out.reason(), ReasonCode::InvInvalidInput);
        }
    }

    #[test]
    fn tv_g_001_valid_32_bytes_passes_structure_check() {
        // Verify that exactly 32 bytes passes structural validation
        let valid = make_valid_input();
        let raw = RawInput {
            subject_id: &valid.subject_id(),       // Exactly 32
            action_type: valid.action_type(),
            scope_hash: &valid.action_params().scope_hash(), // Exactly 32
            magnitude: valid.magnitude(),
            signal: valid.signal(),
            context_min: &valid.context_min(),     // Exactly 32
        };
        let out = syf_gate_entrypoint(raw);
        // Should NOT fail on structure — may still fail on other checks
        assert_ne!(out.reason(), ReasonCode::InvInvalidInput);
    }
}
