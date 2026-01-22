# ReasonCode Mapping (Closed Set) — v1.0

**Status:** SEALED  
**Version:** 1.0  
**Authority:** `specs/SYF_GATE_INTERFACE.md`

**⚠️ No modifications permitted without re-audit.**

---

## Wire Format

All external communications (HTTP, JSON, logs) MUST use these exact strings.

Internal enum variants (Rust `InvOutOfBounds`, Python `INV_OUT_OF_BOUNDS`) 
MUST be mapped through `reason_wire.ts` before output.

---

## Mapping Table

| ReasonCode (Wire) | HTTP Status | Response Body |
|-------------------|-------------|---------------|
| `NONE` | 200 | `{"verdict":"ALLOW"}` |
| `INV_INVALID_INPUT` | 400 | `{"verdict":"DENY","code":"INV_INVALID_INPUT"}` |
| `INV_OUT_OF_BOUNDS` | 400 | `{"verdict":"DENY","code":"INV_OUT_OF_BOUNDS"}` |
| `INV_BUDGET_EXCEEDED` | 402 | `{"verdict":"DENY","code":"INV_BUDGET_EXCEEDED"}` |
| `INV_CADENCE_EXCEEDED` | 429 | `{"verdict":"DENY","code":"INV_CADENCE_EXCEEDED"}` |
| `INV_SIGNAL_INVALID` | 400 | `{"verdict":"DENY","code":"INV_SIGNAL_INVALID"}` |
| `INV_STATE_IMPOSSIBLE` | 409 | `{"verdict":"DENY","code":"INV_STATE_IMPOSSIBLE"}` |

---

## Rules

1. **Closed Set:** Only the codes listed above are valid. No additions.
2. **No Free Text:** Response bodies contain ONLY `verdict` and `code`. No `message`, `description`, or `error` fields.
3. **Fail-Closed:** Unknown internal codes map to `INV_STATE_IMPOSSIBLE` (HTTP 409).
4. **Isomorphism:** All language implementations MUST produce identical wire output for identical inputs.

---

## Invariants Respected

- **I-9 (No Optimization Target):** No narrative, no explanation, no help text.
- **I-4 (Determinism):** Same reason → same HTTP status → same body.
- **I-1 (Fail-Closed):** Unknown → 409.
