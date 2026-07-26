'use client';

import { MiniKit } from '@worldcoin/minikit-js';
import { useSession } from 'next-auth/react';

/** Wallet address can arrive via MiniKit init, the raw WorldApp injection, or the SIWE session
 *  (where the template stores the address as user.id). */
export function useWalletAddress(): string | undefined {
  const { data: session } = useSession();
  const sessionUser = session?.user as { walletAddress?: string; id?: string } | undefined;
  const sessionAddress = [sessionUser?.walletAddress, sessionUser?.id].find((v) =>
    v && /^0x[0-9a-fA-F]{40}$/.test(v),
  );
  return (
    MiniKit.user?.walletAddress ??
    (typeof window !== 'undefined'
      ? (window as unknown as { WorldApp?: { wallet_address?: string } }).WorldApp?.wallet_address
      : undefined) ??
    sessionAddress
  );
}
