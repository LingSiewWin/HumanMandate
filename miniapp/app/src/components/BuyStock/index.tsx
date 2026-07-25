'use client';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useEffect, useState } from 'react';
import { useWalletAddress } from '@/components/Verify';

const REVERT_PROOF_TX =
  'https://worldchain-sepolia.explorer.alchemy.com/tx/0x2e4defd75474b62c668b5ed721a0a47668e34bc4bdfca7688eab6290113d6f22';

/**
 * María's $5 buy through the permissioned demo pool on World Chain Sepolia.
 * The pool's hook enforces the World ID allowlist on-chain — the standing proof link
 * shows the byte-identical swap from an unverified wallet reverting.
 */
export const BuyStock = ({ serverWallet }: { serverWallet?: string }) => {
  const [state, setState] = useState<'pending' | 'success' | 'failed' | undefined>();
  const [txUrl, setTxUrl] = useState<string>();
  const [receipt, setReceipt] = useState<string>();
  const [verified, setVerified] = useState<boolean>();
  const [errorMsg, setErrorMsg] = useState<string>();
  const walletAddress = useWalletAddress() ?? serverWallet;

  useEffect(() => {
    if (!walletAddress) return;
    let active = true;
    const check = () =>
      fetch(`/api/status/${walletAddress}`)
        .then((r) => r.json())
        .then((d) => {
          if (active) setVerified(Boolean(d.verified));
        })
        .catch(() => undefined);
    check();
    // poll so the card unlocks the moment verification lands on-chain
    const id = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [walletAddress]);

  const onBuy = async () => {
    setState('pending');
    setErrorMsg(undefined);
    try {
      const wallet = walletAddress;
      if (!wallet) throw new Error('No wallet address (MiniKit/session both empty)');
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'buy failed');
      setTxUrl(data.explorer);
      if (data.sharesRaw) {
        const tokens = Number(BigInt(data.sharesRaw) / BigInt(10 ** 12)) / 1e6;
        setReceipt(
          `Order filled: $5.00 → ${tokens.toFixed(4)} tNVDA, delivered to your wallet`,
        );
      }
      setState('success');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
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

      {errorMsg && (
        <p className="break-all rounded bg-red-50 p-2 text-xs text-red-600">{errorMsg}</p>
      )}
      {receipt && (
        <p className="rounded bg-green-50 p-2 text-xs font-medium text-green-700">{receipt}</p>
      )}
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
