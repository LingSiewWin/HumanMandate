import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, isAddress, isHex } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { isVerifiedOnchain } from '@/lib/register-onchain';

const API_URL = 'https://trade-api.gateway.uniswap.org/v1';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const PAXG = '0x45804880De22913dAFE09f4980848ECE6EcbAf78';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-api-key': process.env.UNISWAP_API_KEY!,
  'x-universal-router-version': '2.0',
});

/**
 * The real-asset tier: an eligible wallet buys a real, redeemable asset with real money
 * on Ethereum mainnet through the Uniswap Trading API. PAXG is one troy ounce of gold in
 * a vault, per token — nothing we minted.
 *
 * Guarded twice: the user's wallet must be eligible on-chain, and the operator must set
 * REAL_TRADE_ENABLED — this route spends actual funds.
 */
export async function POST(req: NextRequest) {
  if (process.env.REAL_TRADE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'real_trades_disabled' }, { status: 403 });
  }

  const { wallet, amountUsd } = (await req.json().catch(() => ({}))) as {
    wallet?: `0x${string}`;
    amountUsd?: number;
  };
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  }
  if (!(await isVerifiedOnchain(wallet))) {
    return NextResponse.json({ error: 'wallet_not_verified' }, { status: 403 });
  }

  const usd = Math.min(Math.max(amountUsd ?? 1, 1), 5);
  const amount = String(Math.round(usd * 1e6));

  const account = privateKeyToAccount(process.env.MAINNET_TRADER_KEY as `0x${string}`);
  const transport = http(process.env.MAINNET_RPC_URL);
  const publicClient = createPublicClient({ chain: mainnet, transport });
  const walletClient = createWalletClient({ account, chain: mainnet, transport });

  const quoteRes = await fetch(`${API_URL}/quote`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      swapper: account.address,
      tokenIn: USDC,
      tokenOut: PAXG,
      tokenInChainId: '1',
      tokenOutChainId: '1',
      amount,
      type: 'EXACT_INPUT',
      slippageTolerance: 0.5,
    }),
  });
  const quote = (await quoteRes.json()) as Record<string, unknown>;
  if (!quoteRes.ok) {
    return NextResponse.json({ error: 'quote_failed', detail: quote.detail }, { status: 502 });
  }

  // CLASSIC route without a Permit2 signature: strip permitData entirely (the API rejects null)
  const cleanQuote = Object.fromEntries(
    Object.entries(quote).filter(([k]) => k !== 'permitData' && k !== 'permitTransaction'),
  );
  const swapRes = await fetch(`${API_URL}/swap`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(cleanQuote),
  });
  const swapData = (await swapRes.json()) as { swap?: { to: string; data: string; value?: string }; detail?: string };
  if (!swapRes.ok || !swapData.swap?.data || !isHex(swapData.swap.data)) {
    return NextResponse.json({ error: 'swap_failed', detail: swapData.detail }, { status: 502 });
  }

  const txHash = await walletClient.sendTransaction({
    to: swapData.swap.to as `0x${string}`,
    data: swapData.swap.data as `0x${string}`,
    value: BigInt(swapData.swap.value ?? '0'),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return NextResponse.json({
    success: receipt.status === 'success',
    txHash,
    explorer: `https://etherscan.io/tx/${txHash}`,
    asset: 'PAXG',
    usdIn: usd,
  });
}
