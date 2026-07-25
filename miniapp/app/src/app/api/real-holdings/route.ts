import { NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

const PAXG = '0x45804880De22913dAFE09f4980848ECE6EcbAf78';
const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);

/** Live proof the real-asset tier is not a story: the mainnet balance, read from Ethereum. */
export async function GET() {
  const trader = process.env.MAINNET_TRADER_ADDRESS as `0x${string}` | undefined;
  if (!trader) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

  const client = createPublicClient({ chain: mainnet, transport: http(process.env.MAINNET_RPC_URL) });
  const raw = await client.readContract({
    address: PAXG,
    abi: erc20,
    functionName: 'balanceOf',
    args: [trader],
  });
  const ounces = Number(formatUnits(raw, 18));
  return NextResponse.json({
    asset: 'PAXG',
    ounces,
    grams: Number((ounces * 31.1035).toFixed(4)),
    address: trader,
    explorer: `https://etherscan.io/token/${PAXG}?a=${trader}`,
  });
}
