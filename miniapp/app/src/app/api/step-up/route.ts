import { NextRequest, NextResponse } from 'next/server';
import { hashSignal } from '@worldcoin/idkit-core/hashing';
import type { PrivateKeyAccount } from 'viem/accounts';
import { isAddress } from 'viem';
import { livenessAttestorAccount } from '@/lib/liveness-attestor';

type PortalVerify = {
  success?: boolean;
  detail?: string;
  results?: Array<{ identifier?: string; success?: boolean }>;
};

type IdkitProofBody = {
  action?: string;
  responses?: Array<{ signal_hash?: string }>;
};

const EXPECTED_STEPUP_ACTION =
  process.env.NEXT_PUBLIC_STEPUP_ACTION ?? process.env.STEPUP_ACTION ?? 'mandate-step-up';

/**
 * Liveness step-up. Raising a mandate's cap or changing its recipient is privilege
 * escalation — the one moment a live human must be present, exactly as Face ID guards
 * adding a payee rather than every tap. Routine spending under the existing cap never
 * comes here.
 *
 * The proof must be a FRESH Selfie Check completed for this action; we verify it against
 * World's Developer Portal and only then sign the EIP-712 authorisation the contract
 * checks. We sign, we never send — the user submits the escalation themselves.
 *
 * World docs (configure-credential): backend MUST enforce the same `signal` used in the
 * preset — otherwise a Selfie bound to wallet A can authorize a StepUp for wallet B.
 */
export async function POST(req: NextRequest) {
  const { account, newCap, newRecipient, idkitResponse } = (await req.json().catch(() => ({}))) as {
    account?: `0x${string}`;
    newCap?: string;
    newRecipient?: `0x${string}`;
    idkitResponse?: IdkitProofBody;
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

  const mandateAddress = process.env.MANDATE_ADDRESS;
  if (!mandateAddress || !isAddress(mandateAddress)) {
    return NextResponse.json({ error: 'MANDATE_ADDRESS not configured' }, { status: 500 });
  }

  // Reject proofs minted for a different Portal action.
  if (idkitResponse.action && idkitResponse.action !== EXPECTED_STEPUP_ACTION) {
    return NextResponse.json(
      {
        error: 'wrong_action',
        detail: `expected ${EXPECTED_STEPUP_ACTION}, got ${idkitResponse.action}`,
      },
      { status: 403 },
    );
  }

  // Bind Selfie to this payer: signal_hash must match hash(account).
  const expectedSignal = hashSignal(account).toLowerCase();
  const proofSignal = idkitResponse.responses
    ?.map((r) => r.signal_hash?.toLowerCase())
    .find((h): h is string => Boolean(h));
  if (!proofSignal) {
    return NextResponse.json(
      { error: 'signal_missing', detail: 'proof has no signal_hash; refuse unbound liveness' },
      { status: 403 },
    );
  }
  if (proofSignal !== expectedSignal) {
    return NextResponse.json(
      { error: 'signal_mismatch', detail: 'Selfie signal does not match account' },
      { status: 403 },
    );
  }

  const rpId = process.env.RP_ID;
  if (!rpId) return NextResponse.json({ error: 'RP_ID not configured' }, { status: 500 });

  let signer: PrivateKeyAccount;
  try {
    signer = livenessAttestorAccount();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'attestor key missing' },
      { status: 500 },
    );
  }

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
  const signature = await signer.signTypedData({
    domain: {
      name: 'HumanMandate',
      version: '1',
      chainId: Number(process.env.MANDATE_CHAIN_ID ?? 480),
      verifyingContract: mandateAddress as `0x${string}`,
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
