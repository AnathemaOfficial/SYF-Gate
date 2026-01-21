# STATUS: NON-CANON REFERENCE SKETCH
# Authority: specs/ exclusively

from dataclasses import dataclass, replace
from enum import Enum
from typing import Final


@dataclass(frozen=True)
class CanonicalInput:
    """All fields mandatory, no optional inputs."""
    subject_id: bytes  # 32 bytes
    action_type: "ActionType"
    action_params: "ActionParams"
    magnitude: int
    signal: "Signal"
    context_min: bytes  # 32 bytes


@dataclass(frozen=True)
class ActionParams:
    scope_hash: bytes  # 32 bytes


class ActionType(Enum):
    TRANSFER = 1
    EXECUTE = 2
    DEPLOY = 3
    WRITE = 4


@dataclass(frozen=True)
class Signal:
    r_local: int
    quantified_flow: int
    quantified_entropy: int
    observed_cadence: int


@dataclass(frozen=True)
class Limits:
    max_magnitude: int
    max_cadence: int
    scope: bytes  # 32 bytes


@dataclass(frozen=True)
class FinalityTag:
    tag: bytes  # 32 bytes


class VerdictKind(Enum):
    ALLOW = 1
    DENY = 2


class ReasonCode(Enum):
    """Closed set — free-form messages forbidden."""
    NONE = 0                  # No violation (used with ALLOW)
    INV_INVALID_INPUT = 1     # Malformed input structure
    INV_OUT_OF_BOUNDS = 2     # Parameter exceeds hard-coded limit
    INV_BUDGET_EXCEEDED = 3   # Action exceeds budget constraint
    INV_CADENCE_EXCEEDED = 4  # Action exceeds cadence constraint
    INV_SIGNAL_INVALID = 5    # Signal violates invariant constraints
    INV_STATE_IMPOSSIBLE = 6  # Action would create impossible state


@dataclass(frozen=True)
class GateOutput:
    verdict: VerdictKind
    reason: ReasonCode
    limits: Limits
    finality: FinalityTag


# Hard-coded bounds from invariants (I-3: non-configurable)
MAX_MAGNITUDE: Final[int] = 1_000_000
MAX_CADENCE: Final[int] = 100

# Neutral values for invalid input responses
NEUTRAL_SCOPE: Final[bytes] = b"\x00" * 32
NEUTRAL_FINALITY: Final[bytes] = b"\x00" * 32


def syf_gate(inp: CanonicalInput) -> GateOutput:
    """Pure function — fail-closed, deterministic, no I/O."""

    # =========================================================================
    # TV-G-001: Structural Integrity Check (MUST precede any logic)
    # I-1 (Fail-Closed): Invalid structure = Immediate DENY
    # =========================================================================
    if (len(inp.subject_id) != 32 or
        len(inp.context_min) != 32 or
        len(inp.action_params.scope_hash) != 32):
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_INVALID_INPUT,
            limits=Limits(
                max_magnitude=MAX_MAGNITUDE,
                max_cadence=MAX_CADENCE,
                scope=NEUTRAL_SCOPE,  # Fixed neutral on invalid (can't trust input)
            ),
            finality=FinalityTag(tag=NEUTRAL_FINALITY),
        )

    # From here, structure is valid — use actual scope
    limits = Limits(
        max_magnitude=MAX_MAGNITUDE,
        max_cadence=MAX_CADENCE,
        scope=inp.action_params.scope_hash,
    )
    finality = FinalityTag(tag=NEUTRAL_FINALITY)

    # =========================================================================
    # TV-G-002: Bounds Check
    # I-1 (Fail-Closed): Any out-of-bounds → DENY
    # =========================================================================
    if inp.magnitude > MAX_MAGNITUDE:
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_OUT_OF_BOUNDS,
            limits=limits,
            finality=finality,
        )

    # =========================================================================
    # TV-G-003: Signal Validation
    # I-6 (No Oracle): Signal must be deterministic local data
    # =========================================================================
    if inp.signal.r_local < 0 or inp.signal.quantified_entropy < 0:
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_SIGNAL_INVALID,
            limits=limits,
            finality=finality,
        )

    # =========================================================================
    # Cadence Check (I-3: Bounded Action)
    # =========================================================================
    if inp.signal.observed_cadence > MAX_CADENCE:
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_CADENCE_EXCEEDED,
            limits=limits,
            finality=finality,
        )

    # =========================================================================
    # TV-G-004: Valid Bounded Action
    # All invariants satisfied → ALLOW with NONE reason
    # =========================================================================
    return GateOutput(
        verdict=VerdictKind.ALLOW,
        reason=ReasonCode.NONE,
        limits=limits,
        finality=finality,
    )


# =============================================================================
# TEST VECTORS — deterministic validation only, no I/O
# =============================================================================

def _make_valid_input() -> CanonicalInput:
    return CanonicalInput(
        subject_id=b"\x01" * 32,
        action_type=ActionType.TRANSFER,
        action_params=ActionParams(scope_hash=b"\x00" * 32),
        magnitude=500,
        signal=Signal(
            r_local=100,
            quantified_flow=10,
            quantified_entropy=5,
            observed_cadence=50,
        ),
        context_min=b"\x00" * 32,
    )


def test_tv_g_001_invalid_input() -> None:
    """TV-G-001: Malformed input (wrong length) → DENY + INV_INVALID_INPUT"""
    base = _make_valid_input()
    # Inject genuine structural error: 31 bytes instead of 32
    inp = replace(base, subject_id=b"\x00" * 31)
    out = syf_gate(inp)
    assert out.verdict == VerdictKind.DENY
    assert out.reason == ReasonCode.INV_INVALID_INPUT
    # Verify neutral scope on invalid input
    assert out.limits.scope == NEUTRAL_SCOPE


def test_tv_g_002_excessive_magnitude() -> None:
    """TV-G-002: Valid identity, excessive magnitude → DENY + INV_OUT_OF_BOUNDS"""
    inp = replace(_make_valid_input(), magnitude=1_500_000)
    out = syf_gate(inp)
    assert out.verdict == VerdictKind.DENY
    assert out.reason == ReasonCode.INV_OUT_OF_BOUNDS


def test_tv_g_003_invalid_signal() -> None:
    """TV-G-003: Unstable or invalid signal → DENY + INV_SIGNAL_INVALID"""
    base = _make_valid_input()
    bad_signal = replace(base.signal, r_local=-1)
    inp = replace(base, signal=bad_signal)
    out = syf_gate(inp)
    assert out.verdict == VerdictKind.DENY
    assert out.reason == ReasonCode.INV_SIGNAL_INVALID


def test_tv_g_004_valid_bounded() -> None:
    """TV-G-004: Valid bounded action → ALLOW + NONE"""
    inp = _make_valid_input()
    out = syf_gate(inp)
    assert out.verdict == VerdictKind.ALLOW
    assert out.reason == ReasonCode.NONE
    assert out.limits.max_magnitude >= inp.magnitude


def test_tv_g_005_deterministic_replay() -> None:
    """TV-G-005: Same input → identical verdict (determinism)"""
    inp = _make_valid_input()
    out1 = syf_gate(inp)
    out2 = syf_gate(inp)
    assert out1 == out2


# Note: No __main__ block — I/O forbidden per invariant spirit
