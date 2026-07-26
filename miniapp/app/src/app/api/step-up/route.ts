import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { isAddress } from 'viem';

type PortalVerify = {
  success?: boolean;
  detail?: string;
  results?: Array<{ identifier?: string; success?: boolean }>;
};

/**
 * Liveness step-up. Raising a mandate's cap or changing its recipient is privilege
 * escalation — the one moment a live human must be present, exactly as Face ID guards
 * adding a payee rather than every tap. Routine spending under the existing cap never
 * comes here.
 *
 * The proof must be a FRESH Selfie Check completed for this action; we verify it against
 * World's Developer Portal and only then sign the EIP-712 authorisation the contract
 * checks. We sign, we never send — the user submits the escalation themselves.
 */
export async function POST(req: NextRequest) {
  const { account, newCap, newRecipient, idkitResponse } = (await req.json().catch(() => ({}))) as {
    account?: `0x${string}`;
    newCap?: string;
    newRecipient?: `0x${string}`;
    idkitResponse?: unknown;
  };

  if (!account || !isAddress(account)) {
    return NextResponse.json({ error: 'account required' }, { status: 400 });
  }
  if (!newRecipient || !isAddress(newRecipient)) {
    return NextResponse.json({ error: 'newRecipient required' }, { status: 400 });
  }
  if (!newCap || !/^\d+$/.test(newCap)) {
    return NextResponse.json({ error: 'newCap must be an integer string' }, { status: 400 });
  }
  if (!idkitResponse) {
    return NextResponse.json({ error: 'liveness proof required' }, { status: 400 });
  }

  const rpId = process.env.RP_ID;
  if (!rpId) return NextResponse.json({ error: 'RP_ID not configured' }, { status: 500 });

  const portal = await fetch(
    `https://developer.world.org/api/v4/verify/${encodeURIComponent(rpId)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(idkitResponse),
    },
  );
  const body = (await portal.json()) as PortalVerify;
  if (!portal.ok || body.success !== true) {
    return NextResponse.json(
      { error: 'liveness_not_verified', detail: body.detail ?? `HTTP ${portal.status}` },
      { status: 403 },
    );
  }

  // Short window: the attestation is about a human being present *now*.
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const signer = privateKeyToAccount(process.env.LIVENESS_ATTESTOR_KEY as `0x${string}`);
  const signature = await signer.signTypedData({
    domain: {
      name: 'HumanMandate',
      version: '1',
      chainId: Number(process.env.MANDATE_CHAIN_ID ?? 480),
      verifyingContract: process.env.MANDATE_ADDRESS as `0x${string}`,
    },
    types: {
      StepUp: [
        { name: 'account', type: 'address' },
        { name: 'newCap', type: 'uint128' },
        { name: 'newRecipient', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'StepUp',
    message: {
      account,
      newCap: BigInt(newCap),
      newRecipient,
      deadline,
    },
  });

  return NextResponse.json({ signature, deadline: deadline.toString(), attestor: signer.address });
}
