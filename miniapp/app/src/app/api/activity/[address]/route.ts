import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { readActivity } from '@/lib/activity';
import { MANDATE_ADDRESS } from '@/lib/mandate';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const items = await readActivity(address);
    return NextResponse.json({ items, contract: MANDATE_ADDRESS, chainId: 480 });
  } catch (e) {
    return NextResponse.json(
      {
        error: 'read_failed',
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }
}
