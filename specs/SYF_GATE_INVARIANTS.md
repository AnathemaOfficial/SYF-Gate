# SYF Gate — Invariants (Sealed)

These invariants are **non-negotiable**.
Violation of any single invariant invalidates the Gate.

---

## I-1 — Fail-Closed

Any ambiguity, error, undefined state, or invalid input
**must result in DENY**.

There is no ambiguity resolver.
Ambiguity itself is denial.

---

## I-2 — Separation of Identity and Capacity

No cryptographic identity, signature, or key
is sufficient to authorize an action.

Identity never implies permission.

---

## I-3 — Bounded Action

Every permitted action is **strictly bounded** by construction.

Bounds:
- are **hard-coded** or
- are **derived solely from systemic invariants** (e.g. R, cadence)

Bounds must never be:
- externally configurable
- mutable by operators
- dependent on human input

---

## I-4 — Determinism

For a given CanonicalInput,
SYF Gate **must always produce exactly one verdict**.

No equivalence classes.
No alternative valid outcomes.

---

## I-5 — No Governance

SYF Gate contains:
- no administrator
- no override
- no multisig
- no emergency control

There is no human authority.

---

## I-6 — No Oracle

SYF Gate must not depend on:
- external data feeds
- clocks or time APIs
- probabilistic signals
- human input

Only deterministic, local data is admissible.

---

## I-7 — No Feedback into Laws

SYF Gate must not influence SYF, SyFF,
or any systemic equation.

It filters actions only.

---

## I-8 — Finality

Every verdict is **final and immutable**.

There is no retry-until-allowed loop.
There is no temporal revision.

---

## I-9 — No Optimization Target

SYF Gate optimizes nothing.

It does not maximize or minimize
any metric or signal.

---

## I-10 — Impossibility First

SYF Gate exists to prevent
**impossible systemic states**.

Failure is allowed.
Impossibility is not.
