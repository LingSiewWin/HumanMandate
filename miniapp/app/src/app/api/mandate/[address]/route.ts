import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { worldchain } from 'viem/chains';
import {
  DEFAULT_MANDATE_ID,
  MANDATE_ADDRESS,
  WORLDCHAIN_RPC,
  mandateAbi,
  type MandateView,
} from '@/lib/mandate';

const ZERO = '0x0000000000000000000000000000000000000000';
const ZERO_REF = `0x${'0'.repeat(64)}`;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  // One payer can hold many mandates; the app manages one named card by default.
  const mandateId = (req.nextUrl.searchParams.get('mandateId') ??
    DEFAULT_MANDATE_ID) as `0x${string}`;

  try {
    const client = createPublicClient({
      chain: worldchain,
      transport: http(WORLDCHAIN_RPC),
    });

    const row = await client.readContract({
      address: MANDATE_ADDRESS,
      abi: mandateAbi,
      functionName: 'mandates',
      args: [address as `0x${string}`, mandateId],
    });

    const [
      humanRef,
      token,
      recipient,
      windowCap,
      perTxCap,
      spentInWindow,
      windowStart,
      active,
    ] = row;

    const view: MandateView = {
      humanRef,
      token,
      recipient,
      windowCap: windowCap.toString(),
      perTxCap: perTxCap.toString(),
      spentInWindow: spentInWindow.toString(),
      windowStart: windowStart.toString(),
      active,
      empty: humanRef === ZERO_REF && token === ZERO && !active,
    };

    return NextResponse.json({
      mandate: view,
      contract: MANDATE_ADDRESS,
      mandateId,
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
