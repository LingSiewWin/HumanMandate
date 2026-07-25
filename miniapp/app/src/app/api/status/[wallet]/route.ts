import { NextRequest, NextResponse } from 'next/server';
import { isVerifiedOnchain } from '@/lib/register-onchain';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 });
  }
  const verified = await isVerifiedOnchain(wallet as `0x${string}`);
  return NextResponse.json({ wallet, verified });
}
