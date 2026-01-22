# Reference Implementation Sketches

## ⚠️ DISCLAIMER

This directory contains **non-canonical reference sketches**.

They exist solely to demonstrate that the law-layer specification
is **provably implementable** without violating invariants.

---

## What These Files Are

- Proof-of-concept code
- Provability demonstrations
- Implementation feasibility evidence

## What These Files Are NOT

- Authoritative implementations
- Production-ready code
- Canonical definitions
- Legally binding artifacts

---

## Hierarchy of Authority

```
specs/          ← LAW (canonical, immutable)
    ↓
ref/            ← SKETCH (non-canonical, illustrative)
```

**Any deviation between `ref/` and `specs/` invalidates the sketch — not the law.**

---

## Poison Signal Values Doctrine

When Signal computation fails, implementations MUST return poison values
that guarantee Gate rejection per I-1 (Fail-Closed).

**Canonical Rule:** Any negative value in Signal fields (`r_local`, 
`quantified_flow`, `quantified_entropy`) triggers `INV_SIGNAL_INVALID`.

| Field | Poison Value | Effect |
|-------|--------------|--------|
| `r_local` | `-1` | Triggers `INV_SIGNAL_INVALID` |
| `quantified_flow` | `-1` | Triggers `INV_SIGNAL_INVALID` |
| `quantified_entropy` | `-1` | Triggers `INV_SIGNAL_INVALID` |
| `observed_cadence` | `MAX_INT` | Triggers `INV_CADENCE_EXCEEDED` |

**Rule:** If ANY signal field cannot be computed deterministically,
the entire signal MUST be poisoned. Partial computation is forbidden.

See `SIGNAL_PROVIDER_SPEC.md` in `docs/` for full specification.

---

## Files

| File | Language | Purpose |
|------|----------|---------|
| `syf_gate_ref.rs` | Rust | `no_std`, zero-allocation, panic-free reference |
| `syf_gate_ref.py` | Python | Pure function reference |
| `PANIC_FREE_PROOF.md` | Markdown | Panic-free verification artifact |

---

## Constraints

### Rust (`syf_gate_ref.rs`)
- `#![no_std]` — no standard library
- No heap allocation (`alloc` forbidden)
- No panics — all error paths return `Verdict::Deny`
- No RNG, no time, no external state
- Deterministic SHA-256 for `finality_tag` only
- **Panic-free by construction** — length checked before `copy_from_slice`

### Python (`syf_gate_ref.py`)
- Pure function — no module-level state
- No I/O operations
- Immutable inputs (`frozen=True`)
- Limited imports: `typing`, `enum`, `hashlib` only
- Errors mapped to `Verdict(reason=...)`, no exceptions

---

## Usage

These files may be used for:
- Understanding the specification
- Validating implementation approaches
- Testing invariant compliance

These files must NOT be used for:
- Production deployment
- Canonical reference
- Legal or contractual purposes

---

## Validation

Reference implementations must pass all test vectors
defined in `specs/SYF_GATE_TEST_VECTORS.md`.

Failure to pass any vector indicates implementation error,
**not specification defect**.

---

*Do not treat this as code to deploy.*  
*Treat it as proof that deployment is possible without violating invariants.*
