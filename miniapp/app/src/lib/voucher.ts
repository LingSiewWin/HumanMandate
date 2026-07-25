import { privateKeyToAccount } from 'viem/accounts';

/**
 * Eligibility voucher: the proof verifier SIGNS, it never sends a transaction.
 * Anyone (the user, a relayer, or our executor) can submit it on-chain, so the
 * backend sits outside the user's money path — if we go down, she can still get in.
 */
export async function signEligibilityVoucher(
  account: `0x${string}`,
  nullifierHash: bigint,
  ttlSeconds = 3600,
): Promise<{ signature: `0x${string}`; deadline: string }> {
  const signer = privateKeyToAccount(process.env.BACKEND_SIGNER_KEY as `0x${string}`);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + ttlSeconds);
  const signature = await signer.signTypedData({
    domain: {
      name: 'WorldAllowlistChecker',
      version: '1',
      chainId: Number(process.env.CHAIN_ID ?? 4801),
      verifyingContract: process.env.CHECKER_ADDRESS as `0x${string}`,
    },
    types: {
      EligibilityVoucher: [
        { name: 'account', type: 'address' },
        { name: 'nullifierHash', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'EligibilityVoucher',
    message: { account, nullifierHash, deadline },
  });
  return { signature, deadline: deadline.toString() };
}
