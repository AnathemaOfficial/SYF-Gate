# SignalProvider — Specification P0 (NON-CANON)

**Status:** Non-canon integration adapter  
**Authority:** `specs/` exclusively  
**Version:** P0 (Minimal Implementation)

This document defines a NON-CANON adapter that produces `Signal` 
without introducing oracles or governance.

---

## Invariants Respected

| Invariant | How P0 Complies |
|-----------|-----------------|
| I-3 (Bounded Action) | Budget/cadence are hard-coded constants |
| I-4 (Determinism) | Same subject_id + same state → same signal |
| I-6 (No Oracle) | No external queries, no time APIs, no RNG |

---

## P0 Signal Computation (Hard Rules)

| Field | P0 Value | Source Rule |
|-------|----------|-------------|
| `observed_cadence` | `counter[subject_id]` | Strictly local counter. Infinite window. |
| `quantified_flow` | `budget_remaining` | Mechanical decrement. |
| `quantified_entropy` | `0` | NEUTRAL. No volatility measurement. |
| `r_local` | `1` | PLACEHOLDER. Invariant. |

---

## POISON_SIGNAL

If any field cannot be computed, the SignalProvider MUST return a poison value:

```typescript
const POISON_SIGNAL = {
  r_local: -1n,
  quantified_flow: -1n,
  quantified_entropy: -1n,
  observed_cadence: MAX_INT, // Exceeds MAX_CADENCE
};
```

**Effect:** Gate receives invalid signal → `INV_SIGNAL_INVALID` → DENY.

This ensures **fail-closed** behavior when signal computation fails.

---

## Failure Mode

```
Signal computation fails
        ↓
Return POISON_SIGNAL
        ↓
Gate evaluates: signal.r_local < 0
        ↓
Gate returns: DENY + INV_SIGNAL_INVALID
```

There is no recovery. There is no fallback. Failure = DENY.

---

## ⚠️ Security Note: State Ownership

All SignalProvider state (counters, budgets) **MUST reside in the Trusted Enforcement Layer**.

### Trusted vs Untrusted Boundaries

| Layer | Trust Level | May Read State | May Write State |
|-------|-------------|----------------|-----------------|
| Enforcement (backend/on-chain) | TRUSTED | ✅ Yes | ✅ Yes |
| Preflight (client-side) | UNTRUSTED | ⚠️ Cached copy only | ❌ Never |
| Indexer/API | UNTRUSTED | ✅ Yes (read-only) | ❌ Never |

### Rules

1. **Client Preflight:** MAY read a cached version (e.g., via indexer).
2. **Client Preflight:** MUST NOT write or compute authority.
3. **Enforcement:** MUST use its own local, trusted state database.
4. **Enforcement:** MUST NOT trust client-provided signal values.

### Oracle Violation

Any signal computed from client-provided state is considered **UNTRUSTED POISON**.

```
Client sends: { signal: { r_local: 999, cadence: 0 } }
                              ↓
Enforcement: IGNORE client signal
                              ↓
Enforcement: Compute signal from TRUSTED state
                              ↓
Gate evaluates with TRUSTED signal
```

An attacker who controls the client cannot inject a favorable signal.

---

## Implementation Checklist

- [ ] State stored in trusted database (not client-accessible)
- [ ] Signal computed server-side only
- [ ] POISON_SIGNAL returned on any computation failure
- [ ] No external API calls during signal computation
- [ ] No time-based logic (use counters, not timestamps)
- [ ] No randomness

---

## Future Iterations (P1+)

P0 is intentionally minimal. Future iterations may add:

- **P1:** Sliding window cadence (requires trusted clock)
- **P2:** Entropy from state delta (requires state tracking)
- **P3:** R_local from SyFF computation (requires kernel integration)

Each iteration MUST be audited against I-4 and I-6 before deployment.
