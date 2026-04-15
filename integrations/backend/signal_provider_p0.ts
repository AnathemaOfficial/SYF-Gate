// STATUS: NON-CANON INTEGRATION ADAPTER
// Authority: docs/SIGNAL_PROVIDER_SPEC.md
// Security: TRUSTED — Server-Side Only
//
// ⚠️ WARNING: This module MUST NOT be imported by client-side code.
// ⚠️ WARNING: This module MUST NOT be imported by UNTRUSTED preflight layers.
//
// All state (counters, budgets) resides in the trusted enforcement layer.
// Any signal computed from client-provided state is UNTRUSTED POISON.

// =============================================================================
// TYPES
// =============================================================================

export interface SignalP0 {
  r_local: bigint;
  quantified_flow: bigint;
  quantified_entropy: bigint;
  observed_cadence: bigint;
}

/**
 * POISON_SIGNAL — Used when signal cannot be computed.
 *
 * Per I-1 (Fail-Closed): If any field cannot be computed,
 * Signal is invalid → Gate MUST return DENY.
 *
 * Negative values guarantee INV_SIGNAL_INVALID from Gate.
 */
export const POISON_SIGNAL: SignalP0 = {
  r_local: -1n,
  quantified_flow: -1n,
  quantified_entropy: -1n,
  observed_cadence: BigInt(Number.MAX_SAFE_INTEGER), // Exceeds MAX_CADENCE
};

/**
 * Subject state persisted by a SignalProviderStore.
 * A store is expected to guarantee atomic read-modify-write on the whole
 * struct so that `applyAction` cannot race with a concurrent `getState`.
 */
export interface SubjectState {
  action_count: bigint;      // Total actions (infinite window)
  budget_remaining: bigint;  // Remaining budget
}

/**
 * Storage backend for the P0 SignalProvider's trusted state.
 *
 * Production deployments MUST supply a store whose operations are durable
 * across process restarts (so budget bypass via forced restart is impossible)
 * and atomic against concurrent callers (so a `recordAction` cannot race
 * with another `recordAction` and allow two callers to both observe the
 * pre-decrement budget).
 *
 * The reference `InMemorySignalProviderStore` below satisfies neither and is
 * refused in production by {@link assertStoreIsProductionSafe}.
 */
export interface SignalProviderStore {
  /**
   * Unique implementation identifier. Used by the production-safety check
   * to refuse the in-memory reference store when NODE_ENV === "production".
   */
  readonly kind: string;

  /**
   * Whether this store persists across process restart and is atomic under
   * concurrent callers. `false` for the in-memory reference; `true` for
   * Redis / Postgres / any store that serialises its operations.
   */
  readonly isProductionSafe: boolean;

  /**
   * Read the current state for a subject, creating it with `DEFAULT_BUDGET`
   * if absent. Implementations MUST serialise this with `applyAction` so
   * that a read-modify-write across the two functions cannot tear.
   */
  getState(subjectKey: string): Promise<SubjectState>;

  /**
   * Atomically increment action_count by 1 and decrement budget_remaining
   * by `cost` (clamped at zero). Returns the new state.
   *
   * The implementation MUST be atomic against concurrent callers — either
   * via native atomic primitives (Redis DECRBY) or a locked transaction
   * (Postgres FOR UPDATE, in-process Mutex). Application-level read-then-
   * write is NOT sufficient and will drop updates under concurrency.
   */
  applyAction(subjectKey: string, cost: bigint): Promise<SubjectState>;

  /** Remove any state for the given subject. Administrative only. */
  resetSubject(subjectKey: string): Promise<void>;
}

// =============================================================================
// TRUSTED STATE (reference in-memory store — dev only)
// =============================================================================

// Default budget per subject (hard-coded, non-configurable per I-3)
const DEFAULT_BUDGET: bigint = 1_000_000n;

/**
 * Reference in-memory {@link SignalProviderStore}.
 *
 * **DO NOT USE IN PRODUCTION.** State is lost on process restart (forcing a
 * restart restores every subject to `DEFAULT_BUDGET`, enabling budget bypass)
 * and the map grows unboundedly under attacker-controlled subject_ids.
 *
 * A `Promise`-based mutex chain serialises every operation so that at most
 * one `applyAction` runs at a time per subject. This closes the previous
 * read-modify-write race even though Node is single-threaded today: if an
 * async gap ever appeared between the read and the write, two callers could
 * both observe the pre-decrement budget and both decrement. The chain forces
 * strict ordering.
 */
export class InMemorySignalProviderStore implements SignalProviderStore {
  readonly kind = "in-memory-reference";
  readonly isProductionSafe = false;

  private readonly state = new Map<string, SubjectState>();
  // Per-subject serialisation: each new op chains on the previous one.
  private readonly locks = new Map<string, Promise<void>>();

  async getState(subjectKey: string): Promise<SubjectState> {
    return this.withLock(subjectKey, async () => {
      return this.readOrInit(subjectKey);
    });
  }

  async applyAction(subjectKey: string, cost: bigint): Promise<SubjectState> {
    return this.withLock(subjectKey, async () => {
      const s = this.readOrInit(subjectKey);
      const next: SubjectState = {
        action_count: s.action_count + 1n,
        budget_remaining: s.budget_remaining > cost
          ? s.budget_remaining - cost
          : 0n,
      };
      this.state.set(subjectKey, next);
      return next;
    });
  }

  async resetSubject(subjectKey: string): Promise<void> {
    await this.withLock(subjectKey, async () => {
      this.state.delete(subjectKey);
    });
  }

  private readOrInit(subjectKey: string): SubjectState {
    const existing = this.state.get(subjectKey);
    if (existing) return existing;
    const fresh: SubjectState = {
      action_count: 0n,
      budget_remaining: DEFAULT_BUDGET,
    };
    this.state.set(subjectKey, fresh);
    return fresh;
  }

  private withLock<T>(subjectKey: string, op: () => Promise<T>): Promise<T> {
    const prior = this.locks.get(subjectKey) ?? Promise.resolve();
    const next = prior.then(op, op);
    // We only need `Promise<void>` for chaining, so swallow the T.
    this.locks.set(subjectKey, next.then(() => undefined, () => undefined));
    return next;
  }
}

// =============================================================================
// PRODUCTION-SAFETY GUARD
// =============================================================================

/**
 * Refuses to run the P0 SignalProvider with a non-production-safe store when
 * the current environment looks like production. This closes the Codex /
 * Claude audit finding that an in-memory store silently bypassed budget
 * enforcement across restarts.
 */
export function assertStoreIsProductionSafe(store: SignalProviderStore): void {
  const env =
    (typeof process !== "undefined" && process.env && process.env.NODE_ENV) ||
    undefined;
  if (env === "production" && !store.isProductionSafe) {
    throw new Error(
      `[SYF-Gate] refusing to run SignalProvider with non-production-safe ` +
      `store "${store.kind}" in NODE_ENV=production. ` +
      `Supply a persistent, atomic store (e.g. Redis with DECRBY, Postgres ` +
      `with FOR UPDATE) via setSignalProviderStore().`
    );
  }
}

// =============================================================================
// MODULE-LEVEL DEFAULT STORE (dev convenience; explicit injection preferred)
// =============================================================================

let activeStore: SignalProviderStore = new InMemorySignalProviderStore();

/**
 * Inject the production-safe store before any request handling begins. Call
 * this from your server bootstrap with an implementation backed by Redis,
 * Postgres, or another durable atomic store.
 */
export function setSignalProviderStore(store: SignalProviderStore): void {
  assertStoreIsProductionSafe(store);
  activeStore = store;
}

/** Retrieve the currently-installed store. Mainly for tests. */
export function getSignalProviderStore(): SignalProviderStore {
  return activeStore;
}

// =============================================================================
// P0 SIGNAL PROVIDER (Deterministic, No Oracle)
// =============================================================================

/**
 * Computes Signal using P0 rules.
 *
 * P0 Rules (from SIGNAL_PROVIDER_SPEC.md):
 * - observed_cadence = counter[subject_id] (strictly local, infinite window)
 * - quantified_flow = budget_remaining (mechanical decrement)
 * - quantified_entropy = 0 (NEUTRAL, no volatility measurement)
 * - r_local = 1 (PLACEHOLDER, invariant)
 *
 * @param subjectId 32-byte subject identifier
 * @returns SignalP0 or POISON_SIGNAL on failure
 */
export async function computeSignalP0(subjectId: Uint8Array): Promise<SignalP0> {
  // Structural validation
  if (!subjectId || subjectId.length !== 32) {
    return POISON_SIGNAL;
  }

  assertStoreIsProductionSafe(activeStore);

  const key = Buffer.from(subjectId).toString("hex");
  const state = await activeStore.getState(key);

  // Compute signal (deterministic, local-only)
  return {
    r_local: 1n,                           // P0: Placeholder invariant
    quantified_flow: state.budget_remaining,
    quantified_entropy: 0n,                // P0: Neutral
    observed_cadence: state.action_count,
  };
}

/**
 * Atomically increments action counter and debits budget for a subject.
 * Called AFTER successful Gate ALLOW + execution. The underlying store
 * serialises this with any concurrent `computeSignalP0` for the same
 * subject so no two callers can both observe the pre-decrement budget.
 *
 * @param subjectId 32-byte subject identifier
 * @param cost Amount to deduct from budget
 */
export async function recordAction(subjectId: Uint8Array, cost: bigint): Promise<void> {
  if (!subjectId || subjectId.length !== 32) return;
  assertStoreIsProductionSafe(activeStore);
  const key = Buffer.from(subjectId).toString("hex");
  await activeStore.applyAction(key, cost);
}

/**
 * Resets subject state.
 * Administrative function — NOT called during normal operation.
 *
 * Kept exported for tooling use, but production deployments should never
 * wire this into user-reachable code paths; doing so trivially bypasses
 * per-subject budgets.
 */
export async function resetSubject(subjectId: Uint8Array): Promise<void> {
  if (!subjectId || subjectId.length !== 32) return;
  const key = Buffer.from(subjectId).toString("hex");
  await activeStore.resetSubject(key);
}

// =============================================================================
// INVARIANTS
// =============================================================================

// I-4 (Determinism): Same subjectId → same signal (given same state).
//                    Determinism now requires a durable store in production;
//                    the in-memory reference breaks I-4 on restart.
// I-6 (No Oracle): No external queries, no time APIs, no RNG.
// I-3 (Bounded): Budget and cadence bounded by hard-coded constants and
//                serialised per-subject by the store.
