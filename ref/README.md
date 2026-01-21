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

## Files

| File | Language | Purpose | Status |
|------|----------|---------|--------|
| `syf_gate_ref.rs` | Rust | `no_std`, zero-allocation reference | Planned |
| `syf_gate_ref.py` | Python | Pure function reference | Planned |

**Note:** Reference implementations are currently planned but not yet committed.  
When available, they will serve as feasibility demonstrations only.

---

## Constraints

### Rust (`syf_gate_ref.rs`)
- `#![no_std]` — no standard library
- No heap allocation (`alloc` forbidden)
- No panics — all error paths return `Verdict::Deny`
- No RNG, no time, no external state
- Deterministic SHA-256 for `finality_tag` only

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
