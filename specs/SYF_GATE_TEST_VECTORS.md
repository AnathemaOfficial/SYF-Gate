# SYF Gate — Test Vectors (Deterministic)

---

## TV-G-001 — Invalid Input

- Malformed CanonicalInput
- Expected verdict: `DENY`
- Reason: `INV_INVALID_INPUT`

---

## TV-G-002 — Valid Identity, Excessive Magnitude

- Identity valid
- Magnitude exceeds bound
- Expected verdict: `DENY`
- Reason: `INV_OUT_OF_BOUNDS`

---

## TV-G-003 — Unstable or Invalid Signal

- Signal violates invariant constraints
- Expected verdict: `DENY`
- Reason: `INV_SIGNAL_INVALID`

---

## TV-G-004 — Valid Bounded Action

- All invariants satisfied
- Bounds respected
- Expected verdict: `ALLOW`
- Limits explicitly defined

---

## TV-G-005 — Deterministic Replay

- Same CanonicalInput as TV-G-002
- Expected verdict: identical
- Property tested: determinism

---

## Global Property

For any CanonicalInput,
SYF Gate produces **exactly one verdict**.
