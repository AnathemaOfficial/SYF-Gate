# ReasonCode Mapping (Closed Set) — v2.0

**Status:** SEALED (post-Book-of-SYF revision, 2026-04-16)
**Version:** 2.0
**Authority:** `specs/SYF_GATE_INTERFACE.md` + Book of SYF I-7 (Silence)

**⚠️ No modifications permitted without re-audit.**

---

## Changelog

**v2.0 (2026-04-16)** — Post-Book-of-SYF I-7 (Silence) alignment.
Closes audit finding G-ORACLE: the prior v1.0 mapping used differentiated
HTTP statuses (400/402/409/429) and exposed reason codes in deny bodies,
creating a 5-value network-level oracle that enabled boundary probing.
v2.0 collapses all denies to HTTP 200 with a single opaque body, per
canonical binary-membrane semantics.

**v1.0 (pre-2026-04-16)** — Differentiated statuses + code in body. **Deprecated.**

---

## Wire Format

All external communications (HTTP, JSON, logs) MUST use these exact strings.

Internal enum variants (Rust `InvOutOfBounds`, Python `INV_OUT_OF_BOUNDS`)
MUST be mapped through `reason_wire.ts` before output.

**Critical:** The reason code NEVER appears on the network wire. It exists
only internally for audit logs and operator telemetry.

---

## External Mapping Table (Network Wire — v2.0)

| Internal ReasonCode | HTTP Status | Response Body |
|---------------------|-------------|---------------|
| `NONE` (ALLOW) | 200 | `{"verdict":"ALLOW"}` |
| `INV_INVALID_INPUT` | 200 | `{"verdict":"DENY"}` |
| `INV_OUT_OF_BOUNDS` | 200 | `{"verdict":"DENY"}` |
| `INV_BUDGET_EXCEEDED` | 200 | `{"verdict":"DENY"}` |
| `INV_CADENCE_EXCEEDED` | 200 | `{"verdict":"DENY"}` |
| `INV_SIGNAL_INVALID` | 200 | `{"verdict":"DENY"}` |
| `INV_STATE_IMPOSSIBLE` | 200 | `{"verdict":"DENY"}` |

**All denies are indistinguishable on the wire.** Callers observe only:
- `{"verdict":"ALLOW"}` → action authorized, proceeds to effect
- `{"verdict":"DENY"}` → action impossible (no explanation, no retry hint)

---

## Internal Mapping Table (Audit Logs Only)

When writing to server-side audit logs (never to the network wire):

| Internal ReasonCode | Log tag |
|---------------------|---------|
| `INV_INVALID_INPUT` | `gate.deny.invalid_input` |
| `INV_OUT_OF_BOUNDS` | `gate.deny.out_of_bounds` |
| `INV_BUDGET_EXCEEDED` | `gate.deny.budget_exceeded` |
| `INV_CADENCE_EXCEEDED` | `gate.deny.cadence_exceeded` |
| `INV_SIGNAL_INVALID` | `gate.deny.signal_invalid` |
| `INV_STATE_IMPOSSIBLE` | `gate.deny.state_impossible` |

Operators with audit-log access can analyze deny patterns. Agents on the
network cannot.

---

## SLIME-Core Alignment (Optional External Verdict Form)

The `reason_wire.ts` module also exports `toExternalVerdict()` which maps
the internal `ALLOW / DENY` terminology to the canonical SLIME-Core
binary-membrane form:

| Internal | SLIME-Core External |
|----------|---------------------|
| `ALLOW` | `AUTHORIZED` |
| `DENY` | `IMPOSSIBLE` |

Integrators targeting full SLIME-Core naming alignment may use this
helper. The current Gate contract retains `ALLOW / DENY` for backward
compatibility — both forms satisfy I-7 Silence.

---

## Rules

1. **Closed Set:** Only the codes listed above are valid. No additions.
2. **Binary Wire:** Network-visible body contains ONLY `verdict`. No `code`, `message`, `description`, or `error`.
3. **Uniform HTTP Status:** All verdict responses are HTTP 200. No status differentiation.
4. **Fail-Closed:** Unknown internal codes map to `INV_STATE_IMPOSSIBLE` for audit-log purposes; externally still emits `{"verdict":"DENY"}`.
5. **Isomorphism:** All language implementations MUST produce identical wire output for identical inputs.

---

## Invariants Respected

- **I-7 (Silence)** — Book of SYF canon: external wire is binary, no semantic feedback.
- **I-9 (No Optimization Target):** No narrative, no explanation, no help text.
- **I-4 (Determinism):** Same reason → same binary wire output.
- **I-1 (Fail-Closed):** Unknown → `{"verdict":"DENY"}`.

---

## Cross-References

- Book of SYF: `F:\SYF PROJECT\SYF DOCS\THE-BOOK-OF-SYF.md` (Part IV §6.1, Chapter 8)
- Audit finding: `F:\SYF PROJECT\audits\2026-04-16\MERGE-AUDIT-REPORT-2026-04-16.md` (G-ORACLE)
- SLIME-Core: `ARCHITECTURE_SECURITY_MODEL.md §3` (Binary Enforcement)
