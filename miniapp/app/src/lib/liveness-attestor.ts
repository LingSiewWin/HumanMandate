import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { isHex } from 'viem';

/**
 * Prefer explicit LIVENESS_ATTESTOR_KEY (must match on-chain livenessAttestor).
 * Safe aliases only when deploy used deployer-as-attestor (DeployHumanMandate default):
 * PRIVATE_KEY, then BACKEND_SIGNER_KEY (same deployer in this project).
 */
export function resolveLivenessAttestorKey(): `0x${string}` | null {
  const candidates = [
    process.env.LIVENESS_ATTESTOR_KEY,
    process.env.PRIVATE_KEY,
    process.env.BACKEND_SIGNER_KEY,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
    if (isHex(key) && key.length === 66) return key;
  }
  return null;
}

export function livenessAttestorAccount(): PrivateKeyAccount {
  const key = resolveLivenessAttestorKey();
  if (!key) {
    throw new Error(
      'LIVENESS_ATTESTOR_KEY not configured (set in miniapp/app/.env.local to match on-chain livenessAttestor)',
    );
  }
  return privateKeyToAccount(key);
}
