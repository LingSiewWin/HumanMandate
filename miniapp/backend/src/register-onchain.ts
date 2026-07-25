import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";

const checkerAbi = [
  {
    type: "function",
    name: "verify",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "nullifierHash", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "verified",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// Chain params come from env so the same code serves anvil, World Chain Sepolia (4801), or Base.
async function clients() {
  const transport = http(config.chainRpcUrl());
  const publicClient = createPublicClient({ transport });
  const chainId = await publicClient.getChainId();
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.chainRpcUrl()] } },
  });
  const account = privateKeyToAccount(config.backendSignerKey());
  const wallet = createWalletClient({ account, chain, transport });
  return { publicClient, wallet };
}

/// Registers a proof-verified wallet in WorldAllowlistChecker (owner-only call).
export async function registerOnchain(
  account: `0x${string}`,
  nullifier: string,
): Promise<{ txHash: `0x${string}` }> {
  const { publicClient, wallet } = await clients();
  const txHash = await wallet.writeContract({
    address: config.checkerAddress(),
    abi: checkerAbi,
    functionName: "verify",
    args: [account, BigInt(nullifier)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`verify tx reverted: ${txHash}`);
  return { txHash };
}

export async function isVerifiedOnchain(account: `0x${string}`): Promise<boolean> {
  const { publicClient } = await clients();
  return publicClient.readContract({
    address: config.checkerAddress(),
    abi: checkerAbi,
    functionName: "verified",
    args: [account],
  });
}
