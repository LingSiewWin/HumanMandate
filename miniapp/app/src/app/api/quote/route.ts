import { NextResponse } from 'next/server';

/** Live Uniswap Trading API quote for the real-asset leg (USDC → PAXG, Ethereum mainnet). */
export async function GET() {
  const response = await fetch('https://trade-api.gateway.uniswap.org/v1/quote', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.UNISWAP_API_KEY!,
      'x-universal-router-version': '2.0',
    },
    body: JSON.stringify({
      swapper: '0x557E1E07652B75ABaA667223B11704165fC94d09',
      tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tokenOut: '0x45804880De22913dAFE09f4980848ECE6EcbAf78',
      tokenInChainId: '1',
      tokenOutChainId: '1',
      amount: '1000000',
      type: 'EXACT_INPUT',
      slippageTolerance: 0.5,
    }),
  });
  const data = (await response.json()) as {
    routing?: string;
    quote?: { output?: { amount?: string }; gasFeeUSD?: string };
  };
  if (!response.ok) return NextResponse.json({ error: 'quote_failed' }, { status: 502 });
  const paxgOut = Number(data.quote?.output?.amount ?? 0) / 1e18;
  return NextResponse.json({
    routing: data.routing,
    usdIn: 1,
    paxgOut,
    goldOunces: paxgOut,
    gasFeeUSD: Number(data.quote?.gasFeeUSD ?? 0).toFixed(3),
  });
}
