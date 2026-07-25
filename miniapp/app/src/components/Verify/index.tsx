'use client';
import { IDKit, identityCheck, selfieCheckLegacy, type RpContext } from '@worldcoin/idkit';
import { MiniKit } from '@worldcoin/minikit-js';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

/** Wallet address can arrive via MiniKit init, the raw WorldApp injection, or the SIWE session. */
export function useWalletAddress(): string | undefined {
  const { data: session } = useSession();
  return (
    MiniKit.user?.walletAddress ??
    (typeof window !== 'undefined'
      ? (window as unknown as { WorldApp?: { wallet_address?: string } }).WorldApp?.wallet_address
      : undefined) ??
    (session?.user as { walletAddress?: string } | undefined)?.walletAddress
  );
}

/**
 * Eligibility gate: Identity Check attests 18+ (and nationality for the demo persona)
 * without any document leaving the user's phone. On success the backend registers the
 * wallet in our on-chain allowlist — the pool itself starts accepting their swaps.
 * Falls back to Selfie Check if Identity Check is unavailable (spec fallback chain).
 */
export const Verify = ({ action }: { action: string }) => {
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [useFallback, setUseFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
  const walletAddress = useWalletAddress();

  const onClickVerify = async () => {
    setButtonState('pending');
    setErrorMsg(undefined);
    try {
      const wallet = walletAddress;
      if (!wallet) throw new Error('No wallet address (MiniKit/session both empty)');

      const rpRes = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!rpRes.ok) throw new Error('Failed to get RP signature');

      const rpSig = await rpRes.json();
      const rpContext: RpContext = {
        rp_id: rpSig.rp_id,
        nonce: rpSig.nonce,
        created_at: rpSig.created_at,
        expires_at: rpSig.expires_at,
        signature: rpSig.sig,
      };

      // Signal binds the proof to this wallet: the proof cannot be replayed to
      // allowlist a different address (configure-credentail.md, common parameters).
      const preset = useFallback
        ? selfieCheckLegacy({ signal: wallet })
        : identityCheck({
            attributes: [{ type: 'minimum_age', value: 18 }],
          });

      const request = await IDKit.request({
        app_id: process.env.NEXT_PUBLIC_APP_ID as `app_${string}`,
        action,
        rp_context: rpContext,
        allow_legacy_proofs: useFallback,
      }).preset(preset);

      const completion = await request.pollUntilCompletion();
      if (!completion.success) {
        setErrorMsg(`IDKit: ${JSON.stringify(completion).slice(0, 300)}`);
        setButtonState('failed');
        setTimeout(() => setButtonState(undefined), 2000);
        return;
      }

      const response = await fetch('/api/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rp_id: rpSig.rp_id,
          wallet,
          idkitResponse: completion.result,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTxHash(data.txHash);
        setButtonState('success');
      } else {
        setErrorMsg(`backend: ${data.error ?? 'unknown'} ${data.detail ?? ''}`);
        setButtonState('failed');
        setTimeout(() => setButtonState(undefined), 2000);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setButtonState('failed');
      setTimeout(() => setButtonState(undefined), 2000);
    }
  };

  return (
    <div className="grid w-full gap-4">
      <p className="text-lg font-semibold">Unlock stock buying</p>
      <LiveFeedback
        label={{
          failed: 'Verification failed',
          pending: 'Verifying — nothing leaves your phone',
          success: 'Eligible — allowlisted on-chain',
        }}
        state={buttonState}
        className="w-full"
      >
        <Button
          onClick={onClickVerify}
          disabled={buttonState === 'pending'}
          size="lg"
          variant="primary"
          className="w-full"
        >
          {useFallback ? 'Verify with Selfie Check' : 'Prove I am 18+ (Identity Check)'}
        </Button>
      </LiveFeedback>
      {txHash && (
        <p className="break-all text-xs text-gray-500">allowlist tx: {txHash}</p>
      )}
      {errorMsg && (
        <p className="break-all rounded bg-red-50 p-2 text-xs text-red-600">{errorMsg}</p>
      )}
      <button
        type="button"
        className="text-xs text-gray-400 underline"
        onClick={() => setUseFallback((v) => !v)}
      >
        {useFallback ? 'Use Identity Check instead' : 'Identity Check unavailable? Use Selfie Check'}
      </button>
    </div>
  );
};
