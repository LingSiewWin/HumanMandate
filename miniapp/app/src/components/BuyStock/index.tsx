'use client';
import { MiniKit } from '@worldcoin/minikit-js';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useEffect, useState } from 'react';

const REVERT_PROOF_TX =
  'https://worldchain-sepolia.explorer.alchemy.com/tx/0x2e4defd75474b62c668b5ed721a0a47668e34bc4bdfca7688eab6290113d6f22';

/**
 * María's $5 buy through the permissioned demo pool on World Chain Sepolia.
 * The pool's hook enforces the World ID allowlist on-chain — the standing proof link
 * shows the byte-identical swap from an unverified wallet reverting.
 */
export const BuyStock = () => {
  const [state, setState] = useState<'pending' | 'success' | 'failed' | undefined>();
  const [txUrl, setTxUrl] = useState<string>();
  const [verified, setVerified] = useState<boolean>();

  useEffect(() => {
    const wallet = MiniKit.user?.walletAddress;
    if (!wallet) return;
    fetch(`/api/status/${wallet}`)
      .then((r) => r.json())
      .then((d) => setVerified(Boolean(d.verified)))
      .catch(() => setVerified(undefined));
  }, []);

  const onBuy = async () => {
    setState('pending');
    try {
      const wallet = MiniKit.user?.walletAddress;
      if (!wallet) throw new Error('open inside World App');
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'buy failed');
      setTxUrl(data.explorer);
      setState('success');
    } catch {
      setState('failed');
      setTimeout(() => setState(undefined), 2500);
    }
  };

  return (
    <div className="grid w-full gap-3 rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">NVIDIA</p>
          <p className="text-xs text-gray-500">tNVDA · demo pool · World Chain Sepolia</p>
        </div>
        <p className="text-lg font-semibold">$5</p>
      </div>

      <LiveFeedback
        label={{ failed: 'Pool rejected the trade', pending: 'Swapping in the permissioned pool', success: 'You own your first stock' }}
        state={state}
        className="w-full"
      >
        <Button onClick={onBuy} disabled={state === 'pending' || verified === false} size="lg" variant="primary" className="w-full">
          {verified === false ? 'Verify first — pool will reject you' : 'Buy $5 of NVIDIA'}
        </Button>
      </LiveFeedback>

      {txUrl && (
        <a href={txUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">
          mainnet-grade proof: swap tx on explorer ↗
        </a>
      )}

      <a href={REVERT_PROOF_TX} target="_blank" rel="noreferrer" className="text-xs text-gray-400 underline">
        Proof the pool says no: identical swap from an unverified wallet → reverted on-chain ↗
      </a>
    </div>
  );
};
