import type { IDKitResult } from '@worldcoin/idkit';
import { NextRequest, NextResponse } from 'next/server';
import { isNullifierUsed, markNullifierUsed } from '@/lib/nullifier-store';
import { registerOnchain } from '@/lib/register-onchain';
import { signEligibilityVoucher } from '@/lib/voucher';

type PortalVerifyBody = {
  success?: boolean;
  nullifier?: string;
  detail?: string;
  identity_attested?: boolean;
  results?: Array<{
    success?: boolean;
    nullifier?: string;
    identity_attested?: boolean;
  }>;
};

/**
 * Forwards the IDKit result as-is to the Developer Portal v4 verify API
 * (docs: world-id/integrate.md Step 5), then:
 *  - rejects if the requested identity attributes were not attested
 *  - rejects replayed nullifiers (Step 6)
 *  - registers the wallet in our WorldAllowlistChecker on-chain
 */
export async function POST(req: NextRequest) {
  const expectedRpId = process.env.RP_ID;
  if (!expectedRpId) {
    return NextResponse.json({ error: 'RP_ID not configured' }, { status: 500 });
  }

  const { rp_id, wallet, idkitResponse } = (await req.json()) as {
    rp_id?: string;
    wallet?: `0x${string}`;
    idkitResponse?: IDKitResult;
  };

  if (rp_id !== expectedRpId) {
    return NextResponse.json({ error: 'Invalid rp_id' }, { status: 400 });
  }
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
  }
  if (!idkitResponse) {
    return NextResponse.json({ error: 'idkitResponse is required' }, { status: 400 });
  }

  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${encodeURIComponent(expectedRpId)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(idkitResponse),
    },
  );

  const body = (await response.json()) as PortalVerifyBody;
  if (!response.ok || body.success !== true) {
    return NextResponse.json(
      { error: 'Verification failed', detail: body.detail ?? `HTTP ${response.status}` },
      { status: 400 },
    );
  }

  const firstSuccess = body.results?.find((r) => r.success);
  // Docs say successful Identity Check responses "include identity_attested" without
  // specifying where — accept top-level or per-result (beta feedback item #1).
  const identityAttested = body.identity_attested ?? firstSuccess?.identity_attested;
  if (identityAttested === false) {
    return NextResponse.json({ error: 'attributes_not_attested' }, { status: 403 });
  }

  const nullifier = body.nullifier ?? firstSuccess?.nullifier;
  if (!nullifier) {
    return NextResponse.json({ error: 'no_nullifier_in_response' }, { status: 502 });
  }
  if (await isNullifierUsed(nullifier)) {
    return NextResponse.json({ error: 'nullifier_already_used' }, { status: 409 });
  }

  // Issue a signed eligibility voucher: proof of what we verified, submittable by ANYONE.
  // We also relay it ourselves so the demo stays one-tap, but the voucher is the artifact
  // that keeps the backend off the user's critical path.
  const voucher = await signEligibilityVoucher(wallet, BigInt(nullifier));
  const { txHash } = await registerOnchain(wallet, nullifier);
  await markNullifierUsed(nullifier, wallet);
  return NextResponse.json({ success: true, txHash, voucher });
}
