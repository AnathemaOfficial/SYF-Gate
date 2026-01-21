# SYF Gate

**Law-layer security primitive for autonomous systems.**

SYF Gate separates **cryptographic identity** from **capacity to act**.
It does not decide *who* may act — it decides whether an action can exist
under strict systemic invariants.

This repository contains the **sealed canonical specification** (the law layer),
plus optional non-canonical reference materials.

---

## What SYF Gate Is

SYF Gate is a **thermodynamic-style safety barrier**:
- **Fail-closed**
- **Deterministic**
- **No governance**
- **No oracle**
- **No intent inference**
- **No optimization target**

> Signature ≠ Authorization  
> Identity ≠ Capacity  
> Intelligence ≠ Permission

If an action passes the Gate, it is **not approved** — it is merely **not impossible**.
If an action is blocked, it is **not punished** — it is **structurally disallowed**.

---

## What SYF Gate Is Not

| Misinterpretation | SYF Gate |
|---|---|
| Policy engine | No. Gate enforces structure, not rules. |
| Safety system | No. Gate prevents impossible states only. |
| RBAC / permissions | No. Identity never implies authorization. |
| Governance module | No. There is no administrator, no override, no vote. |
| Oracle consumer | No. External feeds and clocks are forbidden. |
| Alignment framework | No. Gate has no morality, no intent model. |
| Optimizer | No. Gate optimizes nothing and targets no metric. |

---

## Canonical Specification (Sealed)

The canonical law layer is in `specs/`:

- `SYF_GATE.md`
- `SYF_GATE_INVARIANTS.md`
- `SYF_GATE_STATE_MACHINE.md`
- `SYF_GATE_INTERFACE.md`
- `SYF_GATE_TEST_VECTORS.md`

These documents define what SYF Gate **can be** and what it **can never become**.

Any implementation that violates any invariant **is not SYF Gate**.

---

## Provenance

Audit artifacts (non-canonical) may be stored under `provenance/`.

---

## Reference Implementations (Non-Canonical)

Optional sketches may exist under `ref/`.
They are not law. They are feasibility evidence.

---

## Seal Status

**Phase 4.3 specification sealed.**

This README is non-canonical and exists to prevent misinterpretation.
For authoritative definitions, consult `specs/` exclusively.
