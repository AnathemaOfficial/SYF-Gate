# SYF Gate — State Machine (Canonical)

SYF Gate is conceptually **stateless**.
States describe evaluation logic only.

---

## States

### CLOSED
Default state.
No action exists.

---

### OBSERVE
CanonicalInput is received and validated.

---

### ARMED
Invariant evaluation is performed.

---

### ALLOW
The action is permitted **within explicit, fixed bounds**.

---

### DENY
The action is impossible under invariants.

---

## Allowed Transitions

```
CLOSED  → OBSERVE
OBSERVE → ARMED | DENY
ARMED   → ALLOW | DENY
ALLOW   → CLOSED
DENY    → CLOSED
ANY     → DENY (on invariant violation)
```

---

## Absolute Rule

Any state or transition
not explicitly listed here
is forbidden.

---

## Fail-Closed Guarantee

If evaluation becomes undefined at any point,
the system **must return DENY**.
