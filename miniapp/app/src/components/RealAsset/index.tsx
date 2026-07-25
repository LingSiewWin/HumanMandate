'use client';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useEffect, useState } from 'react';
import { useWalletAddress } from '@/components/Verify';

type Holdings = { ounces: number; grams: number; explorer: string };

/**
 * The real-asset tier. Everything above this card runs on a test network to prove the
 * eligibility gate; this card spends real money on Ethereum mainnet and buys a real,
 * redeemable asset — PAXG is one troy ounce of vaulted gold per token, issued by Paxos
 * under NYDFS supervision. Nothing here is minted by us.
 */
export const RealAsset = ({ serverWallet }: { serverWallet?: string }) => {
  const walletAddress = useWalletAddress() ?? serverWallet;
  const [holdings, setHoldings] = useState<Holdings>();
  const [state, setState] = useState<'pending' | 'success' | 'failed' | undefined>();
  const [txUrl, setTxUrl] = useState<string>();
  const [errorMsg, setErrorMsg] = useState<string>();

  useEffect(() => {
    const load = () =>
      fetch('/api/real-holdings')
        .then((r) => r.json())
        .then((d) => typeof d.ounces === 'number' && setHoldings(d))
        .catch(() => undefined);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const onBuy = async () => {
    setState('pending');
    setErrorMsg(undefined);
    try {
      const res = await fetch('/api/buy-real', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, amountUsd: 1 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'buy failed');
      setTxUrl(data.explorer);
      setState('success');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
      setState('failed');
      setTimeout(() => setState(undefined), 2500);
    }
  };

  return (
    <div className="grid w-full gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Real gold · Ethereum mainnet</p>
          <p className="text-xs text-gray-500">
            PAXG — one troy ounce of vaulted gold per token, issued by Paxos. Not minted by us.
          </p>
        </div>
        <p className="text-lg font-semibold">$1</p>
      </div>

      {holdings && holdings.ounces > 0 && (
        <a
          href={holdings.explorer}
          target="_blank"
          rel="noreferrer"
          className="rounded bg-white/70 p-2 text-xs text-amber-900 underline"
        >
          Already held: {holdings.grams} g of gold ({holdings.ounces.toFixed(6)} oz) — verify on
          Etherscan ↗
        </a>
      )}

      <LiveFeedback
        label={{ failed: 'Trade refused', pending: 'Buying real gold on mainnet', success: 'You own real gold' }}
        state={state}
        className="w-full"
      >
        <Button onClick={onBuy} disabled={state === 'pending'} size="lg" variant="primary" className="w-full">
          Buy $1 of real gold
        </Button>
      </LiveFeedback>

      {errorMsg && <p className="break-all rounded bg-red-50 p-2 text-xs text-red-600">{errorMsg}</p>}
      {txUrl && (
        <a href={txUrl} target="_blank" rel="noreferrer" className="break-all text-xs text-blue-600 underline">
          Mainnet trade on Etherscan ↗
        </a>
      )}
    </div>
  );
};
