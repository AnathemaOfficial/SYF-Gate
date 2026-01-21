# SYF Gate — Interface (Canonical)

All fields defined here are **mandatory**.
No optional inputs are permitted.

---

## CanonicalInput

- `subject_id`  
  Stable identifier (hash of key, account, or attestation)

- `action_type`  
  Finite enum (e.g. TRANSFER, EXECUTE, DEPLOY, WRITE)

- `action_params`  
  Strictly bounded parameters (no free-form data)

- `magnitude`  
  Discrete, bounded intensity level

- `signal`  
  Deterministic local measures:
  - R_local (explicit value or canonical NULL)
  - quantified flow
  - quantified entropy
  - observed cadence

- `context_min`  
  Deterministic minimal context
  (e.g. canonical monotonic counter or fixed NULL)

---

## Output — Verdict

- `verdict`  
  One of: `ALLOW`, `DENY`

- `reason_code`  
  Canonical reason identifier

- `limits`  
  Explicit, non-configurable bounds:
  - maximum budget
  - maximum cadence
  - scope

- `finality_tag`  
  Deterministic hash of the verdict

---

## Reason Codes (Closed Set)

- `NONE` — No violation (used with ALLOW)
- `INV_INVALID_INPUT` — Malformed input structure
- `INV_OUT_OF_BOUNDS` — Parameter exceeds hard-coded limit
- `INV_BUDGET_EXCEEDED` — Action exceeds budget constraint
- `INV_CADENCE_EXCEEDED` — Action exceeds cadence constraint
- `INV_SIGNAL_INVALID` — Signal violates invariant constraints
- `INV_STATE_IMPOSSIBLE` — Action would create impossible state

Free-form messages are forbidden.
