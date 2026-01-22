# ref/syf_gate_ref.py
# STATUS: NON-CANON REFERENCE SKETCH
# Authority: specs/ exclusively
#
# OPTION A: "no crash" gate
# - syf_gate() MUST return GateOutput for any input (fail-closed).
# - Structural invalidity => DENY + INV_INVALID_INPUT (TV-G-001 honest)
# - Signal POISON doctrine => any negative value => INV_SIGNAL_INVALID

from dataclasses import dataclass, replace
from enum import Enum
from typing import Final, Union


# ----------------------------
# Types (mirror the sealed interface shape)
# ----------------------------

class ActionType(Enum):
    TRANSFER = 1
    EXECUTE = 2
    DEPLOY = 3
    WRITE = 4


@dataclass(frozen=True)
class ActionParams:
    scope_hash: bytes  # expected 32 bytes


@dataclass(frozen=True)
class Signal:
    r_local: int
    quantified_flow: int
    quantified_entropy: int
    observed_cadence: int


@dataclass(frozen=True)
class CanonicalInput:
    subject_id: bytes  # expected 32 bytes
    action_type: ActionType
    action_params: ActionParams
    magnitude: int
    signal: Signal
    context_min: bytes  # expected 32 bytes


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
    # Closed set — no free-form messages.
    NONE = 0
    INV_INVALID_INPUT = 1
    INV_OUT_OF_BOUNDS = 2
    INV_BUDGET_EXCEEDED = 3
    INV_CADENCE_EXCEEDED = 4
    INV_SIGNAL_INVALID = 5
    INV_STATE_IMPOSSIBLE = 6


@dataclass(frozen=True)
class GateOutput:
    verdict: VerdictKind
    reason: ReasonCode
    limits: Limits
    finality: FinalityTag


# ----------------------------
# Hard-coded bounds (I-3)
# ----------------------------

MAX_MAGNITUDE: Final[int] = 1_000_000
MAX_CADENCE: Final[int] = 100

NEUTRAL_FINALITY: Final[bytes] = b"\x00" * 32

# POISON doctrine (P0):
# - Any negative value inside Signal is treated as "invalid signal" and must DENY.
# - Integrations may use poison values to force deterministic DENY when SignalProvider fails.
POISON_R_LOCAL: Final[int] = -1
POISON_ENTROPY: Final[int] = -1


def _mk_limits(scope: bytes) -> Limits:
    # Keep scope as-is (even if malformed) for non-canon ref; structural checks happen before.
    return Limits(max_magnitude=MAX_MAGNITUDE, max_cadence=MAX_CADENCE, scope=scope)


def _mk_finality() -> FinalityTag:
    return FinalityTag(tag=NEUTRAL_FINALITY)


def _is_bytes32(x: object) -> bool:
    return isinstance(x, (bytes, bytearray)) and len(x) == 32


# ----------------------------
# Gate (pure, fail-closed)
# ----------------------------

def syf_gate(inp: object) -> GateOutput:
    """
    Pure function — fail-closed, deterministic, no I/O.
    OPTION A: Never raises for control flow; returns DENY on any ambiguity.
    """

    # If input isn't even the right type => DENY (structural invalid).
    if not isinstance(inp, CanonicalInput):
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_INVALID_INPUT,
            limits=_mk_limits(scope=b"\x00" * 32),
            finality=_mk_finality(),
        )

    limits = _mk_limits(scope=inp.action_params.scope_hash if isinstance(inp.action_params, ActionParams) else b"\x00" * 32)
    finality = _mk_finality()

    # TV-G-001: Structural Integrity Check (MUST be first)
    if (
        not _is_bytes32(inp.subject_id)
        or not _is_bytes32(inp.context_min)
        or not isinstance(inp.action_params, ActionParams)
        or not _is_bytes32(inp.action_params.scope_hash)
        or not isinstance(inp.action_type, ActionType)
        or not isinstance(inp.magnitude, int)
        or not isinstance(inp.signal, Signal)
    ):
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_INVALID_INPUT,
            limits=limits,
            finality=finality,
        )

    # Out-of-bounds magnitude (I-3 bounded action)
    if inp.magnitude < 0 or inp.magnitude > MAX_MAGNITUDE:
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_OUT_OF_BOUNDS,
            limits=limits,
            finality=finality,
        )

    # Signal invalid (POISON doctrine)
    # Any negative => invalid signal => DENY
    if (
        inp.signal.r_local < 0
        or inp.signal.quantified_flow < 0
        or inp.signal.quantified_entropy < 0
        or inp.signal.observed_cadence < 0
    ):
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_SIGNAL_INVALID,
            limits=limits,
            finality=finality,
        )

    # Cadence check (bounded)
    if inp.signal.observed_cadence > MAX_CADENCE:
        return GateOutput(
            verdict=VerdictKind.DENY,
            reason=ReasonCode.INV_CADENCE_EXCEEDED,
            limits=limits,
            finality=finality,
        )

    # Budget check (optional in P0 if you model it)
    # NOTE: Not enforced here unless your canon vectors include it.

    # If all invariants satisfied => ALLOW (ReasonCode.NONE)
    return GateOutput(
        verdict=VerdictKind.ALLOW,
        reason=ReasonCode.NONE,
        limits=limits,
        finality=finality,
    )


# ----------------------------
# Test vectors (minimal)
# ----------------------------

def _make_valid_input() -> CanonicalInput:
    return CanonicalInput(
        subject_id=b"\x01" * 32,
        action_type=ActionType.TRANSFER,
        action_params=ActionParams(scope_hash=b"\x02" * 32),
        magnitude=500,
        signal=Signal(
            r_local=1,
            quantified_flow=0,
            quantified_entropy=0,
            observed_cadence=0,
        ),
        context_min=b"\x03" * 32,
    )


def test_tv_g_001_invalid_input() -> None:
    base = _make_valid_input()
    bad = replace(base, subject_id=b"\x00" * 31)  # malformed (31 bytes)
    out = syf_gate(bad)
    assert out.verdict == VerdictKind.DENY
    assert out.reason == ReasonCode.INV_INVALID_INPUT


def test_tv_g_002_excessive_magnitude() -> None:
    base = _make_valid_input()
    bad = replace(base, magnitude=MAX_MAGNITUDE + 1)
    out = syf_gate(bad)
    assert out.verdict == VerdictKind.DENY
    assert out.reason == ReasonCode.INV_OUT_OF_BOUNDS


def test_tv_g_003_invalid_signal_poison() -> None:
    base = _make_valid_input()
    bad_sig = replace(base.signal, r_local=POISON_R_LOCAL)
    bad = replace(base, signal=bad_sig)
    out = syf_gate(bad)
    assert out.verdict == VerdictKind.DENY
    assert out.reason == ReasonCode.INV_SIGNAL_INVALID


def test_tv_g_004_valid_bounded() -> None:
    inp = _make_valid_input()
    out = syf_gate(inp)
    assert out.verdict == VerdictKind.ALLOW
    assert out.reason == ReasonCode.NONE


def test_tv_g_005_deterministic_replay() -> None:
    inp = _make_valid_input()
    out1 = syf_gate(inp)
    out2 = syf_gate(inp)
    assert out1 == out2


if __name__ == "__main__":
    # Basic self-run
    test_tv_g_001_invalid_input()
    test_tv_g_002_excessive_magnitude()
    test_tv_g_003_invalid_signal_poison()
    test_tv_g_004_valid_bounded()
    test_tv_g_005_deterministic_replay()
    print("OK: TV-G-001..TV-G-005 passed")
