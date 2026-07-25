import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';

const erc20 = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

/** Real on-chain position: the user's World App wallet holds the stock token itself. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 });
  }
  const stockToken = process.env.DEMO_STOCK_TOKEN as `0x${string}`;
  const publicClient = createPublicClient({ transport: http(process.env.CHAIN_RPC_URL!) });
  const raw = await publicClient.readContract({
    address: stockToken,
    abi: erc20,
    functionName: 'balanceOf',
    args: [wallet as `0x${string}`],
  });
  // demo pool is ~1:1 dUSD per tNVDA; NVDA reference price for share conversion
  const NVDA_USD = 201.6;
  const tokens = Number(formatUnits(raw, 18));
  return NextResponse.json({
    wallet,
    tokenSymbol: 'tNVDA',
    tokensRaw: raw.toString(),
    tokens,
    valueUsd: Number(tokens.toFixed(2)),
    shares: Number((tokens / NVDA_USD).toFixed(6)),
    token: stockToken,
  });
}
