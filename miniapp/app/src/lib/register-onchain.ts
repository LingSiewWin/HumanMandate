import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const checkerAbi = [
  {
    type: 'function',
    name: 'verify',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'nullifierHash', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'verified',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
};

async function clients() {
  const rpcUrl = env('CHAIN_RPC_URL');
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ transport });
  const chainId = await publicClient.getChainId();
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const account = privateKeyToAccount(env('BACKEND_SIGNER_KEY') as `0x${string}`);
  const wallet = createWalletClient({ account, chain, transport });
  return { publicClient, wallet };
}

/** Registers a proof-verified wallet in WorldAllowlistChecker (owner-only call). */
export async function registerOnchain(
  account: `0x${string}`,
  nullifier: string,
): Promise<{ txHash: `0x${string}` }> {
  const { publicClient, wallet } = await clients();
  const txHash = await wallet.writeContract({
    address: env('CHECKER_ADDRESS') as `0x${string}`,
    abi: checkerAbi,
    functionName: 'verify',
    args: [account, BigInt(nullifier)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error(`verify tx reverted: ${txHash}`);
  return { txHash };
}

export async function isVerifiedOnchain(account: `0x${string}`): Promise<boolean> {
  const { publicClient } = await clients();
  return publicClient.readContract({
    address: env('CHECKER_ADDRESS') as `0x${string}`,
    abi: checkerAbi,
    functionName: 'verified',
    args: [account],
  });
}
