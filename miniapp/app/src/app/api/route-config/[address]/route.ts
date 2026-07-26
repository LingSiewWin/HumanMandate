import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { worldchain } from 'viem/chains';
import { DEFAULT_MANDATE_ID, WORLDCHAIN_RPC } from '@/lib/mandate';
import { SWAPPER_ADDRESS, swapperAbi, type RouteView } from '@/lib/swapper';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  // A route is declared per mandate, so the id has to travel with the read.
  const mandateId = (req.nextUrl.searchParams.get('mandateId') ??
    DEFAULT_MANDATE_ID) as `0x${string}`;

  try {
    const client = createPublicClient({
      chain: worldchain,
      transport: http(WORLDCHAIN_RPC),
    });

    const row = await client.readContract({
      address: SWAPPER_ADDRESS,
      abi: swapperAbi,
      functionName: 'routes',
      args: [address as `0x${string}`, mandateId],
    });

    const [humanRef, tokenIn, tokenOut, payee, set] = row;

    const view: RouteView = { humanRef, tokenIn, tokenOut, payee, set };

    return NextResponse.json({
      route: view,
      contract: SWAPPER_ADDRESS,
      mandateId,
      chainId: 480,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: 'read_failed',
        detail: e instanceof Error ? e.message : String(e),
        contract: SWAPPER_ADDRESS,
      },
      { status: 502 },
    );
  }
}
