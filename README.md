# SYF Gate

**Law-layer security primitive for autonomous systems.**

---

## What SYF Gate Is

SYF Gate separates **cryptographic identity** from **capacity to act**.

It evaluates whether an action is **systemically possible** — not whether it is permitted, authorized, or desirable.

SYF Gate is:
- A **filter**, not a controller
- A **barrier**, not a gatekeeper
- A **law**, not a policy

---

## What SYF Gate Is NOT

| Misconception | Reality |
|---------------|---------|
| Access control system | No. Identity does not grant access. |
| Permission layer | No. Gate does not "permit" — it determines impossibility. |
| Smart contract | No. Gate has no state, no storage, no execution logic. |
| Governance mechanism | No. There is no administrator, no override, no vote. |
| Oracle consumer | No. Gate queries nothing external. |
| AI/ML component | No. Gate does not learn, predict, or optimize. |
| Policy engine | No. Gate enforces structure, not rules. |
| Safety system | No. Gate prevents impossible states, not undesirable ones. |

---

## Core Principle

> **If an action passes the Gate, it is not approved — it is merely not impossible.**
>
> **If an action is blocked, it is not punished — it is structurally disallowed.**

---

## Invariants (Summary)

SYF Gate enforces ten non-negotiable invariants:

| ID | Invariant | Meaning |
|----|-----------|---------|
| I-1 | Fail-Closed | Ambiguity = DENY |
| I-2 | Identity ≠ Capacity | Signature never implies permission |
| I-3 | Bounded Action | Limits are hard-coded, never configurable |
| I-4 | Determinism | One input → one verdict, always |
| I-5 | No Governance | No admin, no override, no multisig |
| I-6 | No Oracle | No external data, no time, no randomness |
| I-7 | No Feedback | Gate does not modify SYF/SyFF laws |
| I-8 | Finality | Verdicts are immutable |
| I-9 | No Optimization | Gate maximizes nothing |
| I-10 | Impossibility First | Prevents impossible states, not failures |

Violation of any single invariant **invalidates the Gate**.

---

## Canonical Documents

All authoritative definitions reside in `specs/`:

```
specs/
├── SYF_GATE.md              # Definition and scope
├── SYF_GATE_INVARIANTS.md   # The ten invariants
├── SYF_GATE_STATE_MACHINE.md # Evaluation states and transitions
├── SYF_GATE_INTERFACE.md    # Input/output contract
└── SYF_GATE_TEST_VECTORS.md # Validation vectors
```

These documents constitute the **law layer**.
They are not guidelines. They are not recommendations.
They define what SYF Gate **can be** and **can never become**.

---

## Reference Implementations

The `ref/` directory may contain non-canonical implementation sketches.

**These are NOT authoritative.**

They exist solely to demonstrate that the specification is **provably implementable** without violating invariants.

Any deviation between `ref/` and `specs/` invalidates the sketch — **not the law**.

---

## Frequently Misunderstood

### "So it's like a firewall?"
No. Firewalls filter by policy. Gate filters by structural impossibility.

### "Can an admin override it?"
No. There is no admin. There is no override mechanism. By design.

### "What if the rules need to change?"
Gate rules do not change. If requirements change, a different system is needed.

### "How does it handle edge cases?"
Ambiguity resolves to DENY. There are no edge cases — only valid inputs and invalid inputs.

### "Is this blockchain-specific?"
No. SYF Gate is chain-agnostic. It operates on abstract inputs, not ledger state.

### "Can AI improve it over time?"
No. Gate does not learn. Intelligence is not a safety mechanism.

---

## Integration Warning

If your system requires:
- Human override capability
- Configurable limits
- External data feeds
- Gradual policy updates
- Optimized outcomes

**SYF Gate is not appropriate for your use case.**

SYF Gate is designed for systems where **trust must be unnecessary**.

---

## License

See repository root for licensing terms.

---

## Status

**Canonical specification sealed.**

This README is non-canonical and exists for educational purposes only.
For authoritative definitions, consult `specs/` exclusively.
