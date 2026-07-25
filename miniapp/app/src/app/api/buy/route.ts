import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, defineChain, http, isHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isVerifiedOnchain } from '@/lib/register-onchain';

/**
 * Demo-pool buy: executes the fixed $5 tNVDA swap through our permissioned pool on
 * World Chain Sepolia. The swap calldata is sender-agnostic (recipient = router locker),
 * pre-encoded by the deploy script; the executor wallet must itself be allowlisted —
 * which is the whole point. The user's wallet must ALSO be verified before we execute,
 * so the gate is enforced twice: app-level (this check) and pool-level (the hook).
 */
export async function POST(req: NextRequest) {
  const { wallet } = (await req.json().catch(() => ({}))) as { wallet?: `0x${string}` };
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  }

  // Pool-level enforcement is against the executor; app-level we require the USER be verified
  const userVerified = await isVerifiedOnchain(wallet);
  if (!userVerified) {
    return NextResponse.json({ error: 'wallet_not_verified' }, { status: 403 });
  }

  const router = process.env.DEMO_SWAP_ROUTER as `0x${string}` | undefined;
  if (!router) return NextResponse.json({ error: 'DEMO_SWAP_ROUTER not configured' }, { status: 500 });

  let calldata: string;
  try {
    calldata = (await readFile(join(process.cwd(), 'demo-swap-calldata.txt'), 'utf8')).trim();
  } catch {
    return NextResponse.json({ error: 'demo calldata missing' }, { status: 500 });
  }
  if (!isHex(calldata)) return NextResponse.json({ error: 'bad calldata' }, { status: 500 });

  // execute(bytes,bytes[],uint256): head slots = [commandsOffset, inputsOffset, deadline].
  // Refresh the baked-in deadline (3rd head word, bytes 4+64..4+96 after selector).
  const prefixLen = 2 + 8 + 64 * 2;
  const freshDeadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
    .toString(16)
    .padStart(64, '0');
  calldata = calldata.slice(0, prefixLen) + freshDeadline + calldata.slice(prefixLen + 64);

  const rpcUrl = process.env.CHAIN_RPC_URL!;
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ transport });
  const chainId = await publicClient.getChainId();
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const account = privateKeyToAccount(process.env.BACKEND_SIGNER_KEY as `0x${string}`);
  const walletClient = createWalletClient({ account, chain, transport });

  const txHash = await walletClient.sendTransaction({ to: router, data: calldata as `0x${string}` });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return NextResponse.json({
    success: receipt.status === 'success',
    txHash,
    explorer: `https://worldchain-sepolia.explorer.alchemy.com/tx/${txHash}`,
  });
}
