// STATUS: NON-CANON INTEGRATION ADAPTER
// Authority: None — UX convenience only
// Security: ⚠️ UNTRUSTED ⚠️
//
// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  WARNING: THIS IS AN UNTRUSTED LAYER                                      ║
// ║                                                                           ║
// ║  This module provides CLIENT-SIDE preflight checks for UX purposes.       ║
// ║  It is NOT a security mechanism.                                          ║
// ║                                                                           ║
// ║  An attacker who bypasses preflight MUST NOT be able to bypass the law.   ║
// ║  Enforcement (on-chain or trusted backend) is the SOLE source of truth.   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { 
  packCanonicalInput, 
  PackResult, 
  RawIntent 
} from '../common/pack_canonical_input';
import { ReasonCodeWire } from '../common/reason_wire';

// =============================================================================
// TYPES
// =============================================================================

export interface PreflightResult {
  ok: boolean;
  code: ReasonCodeWire;
  hint?: string; // UX hint only — NOT passed to enforcement
}

export interface CachedSignalHint {
  estimated_cadence: bigint;
  estimated_budget: bigint;
}

// =============================================================================
// UNTRUSTED SIGNAL CACHE
// =============================================================================

// Client-side cache populated from indexer/read-only sources
// This is UNTRUSTED — enforcement uses its own state.
let cachedSignalHint: CachedSignalHint | null = null;

/**
 * Updates cached signal hint from external source.
 * Called by client from indexer/API read.
 * 
 * ⚠️ This data is UNTRUSTED and used for UX only.
 */
export function updateCachedSignalHint(hint: CachedSignalHint): void {
  cachedSignalHint = hint;
}

/**
 * Clears cached signal hint.
 */
export function clearCachedSignalHint(): void {
  cachedSignalHint = null;
}

// =============================================================================
// PREFLIGHT CHECK (UNTRUSTED UX LAYER)
// =============================================================================

// Hard-coded bounds (mirror of enforcement layer)
const MAX_MAGNITUDE_HINT = 1_000_000n;
const MAX_CADENCE_HINT = 100n;

/**
 * Performs client-side preflight validation.
 * 
 * PURPOSE: Provide immediate UX feedback before submitting to enforcement.
 * 
 * ⚠️ THIS DOES NOT PROVIDE SECURITY.
 * ⚠️ Enforcement layer performs authoritative validation.
 * ⚠️ Never trust this result for access control.
 * 
 * @param intent Raw intent to validate
 * @returns PreflightResult with UX hints
 */
export function gatePrecheck(intent: RawIntent): PreflightResult {
  // Step 1: Structural validation (same as enforcement)
  const packResult: PackResult = packCanonicalInput(intent);
  
  if (!packResult.ok) {
    return {
      ok: false,
      code: packResult.code,
      hint: "Input structure invalid. Check field lengths.",
    };
  }

  // Step 2: Bounds check (UX only — enforcement re-checks)
  if (intent.magnitude > MAX_MAGNITUDE_HINT) {
    return {
      ok: false,
      code: "INV_OUT_OF_BOUNDS",
      hint: `Magnitude ${intent.magnitude} exceeds limit ${MAX_MAGNITUDE_HINT}.`,
    };
  }

  // Step 3: Cached signal hint check (if available)
  if (cachedSignalHint) {
    if (cachedSignalHint.estimated_cadence >= MAX_CADENCE_HINT) {
      return {
        ok: false,
        code: "INV_CADENCE_EXCEEDED",
        hint: "Rate limit likely exceeded. Try again later.",
      };
    }

    if (cachedSignalHint.estimated_budget < intent.magnitude) {
      return {
        ok: false,
        code: "INV_BUDGET_EXCEEDED",
        hint: "Insufficient budget for this action.",
      };
    }
  }

  // Preflight passed — but this is NOT authorization
  return {
    ok: true,
    code: "NONE",
    hint: "Preflight passed. Submit to enforcement for final verdict.",
  };
}

/**
 * Quick structural validation only.
 * Does not check bounds or cached signals.
 */
export function validateStructureOnly(intent: RawIntent): PreflightResult {
  const packResult = packCanonicalInput(intent);
  
  if (!packResult.ok) {
    return { ok: false, code: packResult.code };
  }
  
  return { ok: true, code: "NONE" };
}
