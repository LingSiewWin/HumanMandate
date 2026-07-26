import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { worldchain } from 'viem/chains';
import {
  MANDATE_ADDRESS,
  WORLDCHAIN_RPC,
  mandateAbi,
  type MandateView,
} from '@/lib/mandate';

const ZERO = '0x0000000000000000000000000000000000000000';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const client = createPublicClient({
      chain: worldchain,
      transport: http(WORLDCHAIN_RPC),
    });

    const row = await client.readContract({
      address: MANDATE_ADDRESS,
      abi: mandateAbi,
      functionName: 'mandates',
      args: [address as `0x${string}`],
    });

    const [humanId, token, recipient, dailyCap, spentToday, day, active] = row;
    const empty = humanId === BigInt(0) && token === ZERO && !active;

    const view: MandateView = {
      humanId: humanId.toString(),
      token,
      recipient,
      dailyCap: dailyCap.toString(),
      spentToday: spentToday.toString(),
      day: day.toString(),
      active,
      empty,
    };

    return NextResponse.json({
      mandate: view,
      contract: MANDATE_ADDRESS,
      chainId: 480,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: 'read_failed',
        detail: e instanceof Error ? e.message : String(e),
        contract: MANDATE_ADDRESS,
      },
      { status: 502 },
    );
  }
}
