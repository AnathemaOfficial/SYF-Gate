// STATUS: NON-CANON INTEGRATION ADAPTER
// Authority: specs/SYF_GATE_INTERFACE.md
// Layer: Account Abstraction (EIP-4337)
//
// ⚠️ WARNING: HASH ALGORITHM IS PLACEHOLDER
// ⚠️ This uses SHA-256. Production MUST use keccak256 to match EVM.
// ⚠️ Hash algorithm MUST match the enforcement environment.
// ⚠️ This file is NOT production-ready and NOT authoritative.
//
// This module maps EIP-4337 UserOperation to SYF Gate CanonicalInput.
// NO-THROW: Returns Result type per I-1 (Fail-Closed).

import { 
  PackResult, 
  RawIntent, 
  ActionTypeStr,
  packCanonicalInput 
} from '../common/pack_canonical_input';
import { ReasonCodeWire } from '../common/reason_wire';

// =============================================================================
// EIP-4337 TYPES (Minimal)
// =============================================================================

/**
 * Minimal UserOperation structure for Gate integration.
 * Full EIP-4337 has more fields — we extract only what Gate needs.
 */
export interface UserOperationMinimal {
  sender: Uint8Array;           // 20 bytes (address)
  nonce: bigint;
  callData: Uint8Array;         // Variable length
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

/**
 * Intent metadata extracted from callData.
 * Must be parsed by caller before calling packAAUserOp.
 */
export interface AAIntentMeta {
  action_type: ActionTypeStr;
  target: Uint8Array;           // 20 bytes (target contract)
  value: bigint;                // ETH value
}

// =============================================================================
// HASH UTILITIES (Deterministic)
// =============================================================================

/**
 * Pads address (20 bytes) to 32 bytes.
 * Deterministic: left-pad with zeros.
 */
function padAddress(addr: Uint8Array): Uint8Array {
  if (addr.length === 32) return addr;
  if (addr.length !== 20) {
    // Invalid address length — return zeros (will fail validation)
    return new Uint8Array(32);
  }
  const padded = new Uint8Array(32);
  padded.set(addr, 12); // Left-pad: 12 zeros + 20 bytes
  return padded;
}

/**
 * Computes deterministic 32-byte hash from variable-length data.
 * 
 * ⚠️ PLACEHOLDER: Uses SHA-256. Production MUST use keccak256.
 * ⚠️ Hash algorithm MUST match on-chain enforcement.
 * 
 * NOTE: In production, use the same hash as on-chain (keccak256).
 */
async function hash32(data: Uint8Array): Promise<Uint8Array> {
  // ⚠️ PLACEHOLDER: SHA-256 — Replace with keccak256 for EVM compatibility
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Synchronous hash for environments without async crypto.
 * Falls back to simple XOR folding (NOT cryptographically secure).
 * 
 * WARNING: Use only for testing. Production must use proper hash.
 */
function hash32Sync(data: Uint8Array): Uint8Array {
  // Simple deterministic fold — NOT for production
  const result = new Uint8Array(32);
  for (let i = 0; i < data.length; i++) {
    result[i % 32] ^= data[i];
  }
  return result;
}

// =============================================================================
// AA → CANONICAL INPUT MAPPING
// =============================================================================

/**
 * Maps EIP-4337 UserOperation to SYF Gate RawIntent.
 * 
 * Mapping rules:
 * - subject_id = padded sender address (32 bytes)
 * - action_type = from AAIntentMeta (parsed from callData)
 * - scope_hash = hash(target address) (32 bytes)
 * - magnitude = total gas cost estimate
 * - context_min = hash(nonce || callData prefix)
 * 
 * NO-THROW: Returns PackResult.
 */
export async function packAAUserOp(
  userOp: UserOperationMinimal,
  intent: AAIntentMeta
): Promise<PackResult> {
  
  // Validate sender address
  if (!userOp.sender || (userOp.sender.length !== 20 && userOp.sender.length !== 32)) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  // Validate target address
  if (!intent.target || (intent.target.length !== 20 && intent.target.length !== 32)) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  // Compute subject_id (padded sender)
  const subject_id = padAddress(userOp.sender);

  // Compute scope_hash (hash of target)
  const scope_hash = await hash32(padAddress(intent.target));

  // Compute magnitude (total gas estimate)
  const totalGas = userOp.callGasLimit + 
                   userOp.verificationGasLimit + 
                   userOp.preVerificationGas;
  const magnitude = totalGas * userOp.maxFeePerGas;

  // Compute context_min (anti-replay)
  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, userOp.nonce, false);
  const callDataPrefix = userOp.callData.slice(0, 32);
  const contextData = new Uint8Array(nonceBytes.length + callDataPrefix.length);
  contextData.set(nonceBytes, 0);
  contextData.set(callDataPrefix, nonceBytes.length);
  const context_min = await hash32(contextData);

  // Build RawIntent and delegate to common packer
  const rawIntent: RawIntent = {
    subject_id,
    action_type: intent.action_type,
    scope_hash,
    magnitude,
    context_min,
  };

  return packCanonicalInput(rawIntent);
}

/**
 * Synchronous version for environments without async crypto.
 * WARNING: Uses weak hash — for testing only.
 */
export function packAAUserOpSync(
  userOp: UserOperationMinimal,
  intent: AAIntentMeta
): PackResult {
  
  if (!userOp.sender || (userOp.sender.length !== 20 && userOp.sender.length !== 32)) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  if (!intent.target || (intent.target.length !== 20 && intent.target.length !== 32)) {
    return { ok: false, code: "INV_INVALID_INPUT" };
  }

  const subject_id = padAddress(userOp.sender);
  const scope_hash = hash32Sync(padAddress(intent.target));
  
  const totalGas = userOp.callGasLimit + 
                   userOp.verificationGasLimit + 
                   userOp.preVerificationGas;
  const magnitude = totalGas * userOp.maxFeePerGas;

  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, userOp.nonce, false);
  const callDataPrefix = userOp.callData.slice(0, 32);
  const contextData = new Uint8Array(nonceBytes.length + callDataPrefix.length);
  contextData.set(nonceBytes, 0);
  contextData.set(callDataPrefix, nonceBytes.length);
  const context_min = hash32Sync(contextData);

  const rawIntent: RawIntent = {
    subject_id,
    action_type: intent.action_type,
    scope_hash,
    magnitude,
    context_min,
  };

  return packCanonicalInput(rawIntent);
}

/**
 * Parses callData to extract intent metadata.
 * 
 * This is a PLACEHOLDER — real implementation depends on:
 * - Contract ABI
 * - Selector → ActionType mapping
 * 
 * Returns null if parsing fails (caller should use default or reject).
 */
export function parseCallDataIntent(callData: Uint8Array): AAIntentMeta | null {
  if (callData.length < 4) {
    return null; // No selector
  }

  // Extract 4-byte selector
  const selector = callData.slice(0, 4);
  const selectorHex = Array.from(selector)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Placeholder mapping — extend based on your contracts
  const SELECTOR_MAP: Record<string, ActionTypeStr> = {
    'a9059cbb': 'TRANSFER',  // ERC20 transfer(address,uint256)
    '23b872dd': 'TRANSFER',  // ERC20 transferFrom(address,address,uint256)
    '095ea7b3': 'WRITE',     // ERC20 approve(address,uint256)
    '60806040': 'DEPLOY',    // Contract creation prefix
    // Add more selectors as needed
  };

  const action_type = SELECTOR_MAP[selectorHex] ?? 'EXECUTE';

  // Extract target (first address param, if present)
  let target = new Uint8Array(20);
  if (callData.length >= 36) {
    // Standard ABI: selector (4) + padded address (32)
    target = callData.slice(16, 36); // Skip padding, take 20 bytes
  }

  return {
    action_type,
    target,
    value: 0n, // Would need full tx context
  };
}
