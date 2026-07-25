'use client';
import { useEffect, useState } from 'react';
import { useWalletAddress } from '@/components/Verify';

type Position = {
  tokens: number;
  valueUsd: number;
  shares: number;
  token: string;
};

/**
 * Post-purchase reality: what you OWN, in your own wallet, in human units.
 * Reads the live on-chain balance of the user's World App wallet — not a database row.
 */
export const Portfolio = ({ serverWallet }: { serverWallet?: string }) => {
  const walletAddress = useWalletAddress() ?? serverWallet;
  const [position, setPosition] = useState<Position>();

  useEffect(() => {
    if (!walletAddress) return;
    let active = true;
    const load = () =>
      fetch(`/api/portfolio/${walletAddress}`)
        .then((r) => r.json())
        .then((d) => {
          if (active && typeof d.tokens === 'number') setPosition(d);
        })
        .catch(() => undefined);
    load();
    const id = setInterval(load, 7000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [walletAddress]);

  if (!position || position.tokens === 0) return null;

  return (
    <div className="grid w-full gap-2 rounded-2xl bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-500">Your portfolio</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-semibold">NVIDIA</p>
          <p className="text-xs text-gray-500">
            {position.shares} shares · {position.tokens.toFixed(4)} tNVDA in YOUR wallet
          </p>
        </div>
        <p className="text-xl font-semibold">${position.valueUsd.toFixed(2)}</p>
      </div>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          disabled
          className="flex-1 rounded-full border border-gray-300 py-2 text-sm text-gray-400"
        >
          Sell — coming
        </button>
        <button
          type="button"
          disabled
          className="flex-1 rounded-full border border-gray-300 py-2 text-sm text-gray-400"
        >
          Auto-invest $2/day
        </button>
      </div>
      <p className="text-[10px] leading-snug text-gray-400">
        Demo asset on World Chain Sepolia. Tokenized stocks carry economic exposure, not
        voting rights — we say so out loud.
      </p>
    </div>
  );
};
