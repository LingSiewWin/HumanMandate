'use client';
import { walletAuth } from '@/auth/wallet';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * World App sign-in entry. MiniKit walletAuth under the hood — UI copy stays non-crypto.
 */
export const AuthButton = () => {
  const [isPending, setIsPending] = useState(false);
  const { isInstalled } = useMiniKit();
  const hasAttemptedAuth = useRef(false);

  const onClick = useCallback(async () => {
    if (!isInstalled || isPending) {
      return;
    }
    setIsPending(true);
    try {
      await walletAuth();
    } catch (error) {
      console.error('Authentication button error', error);
    } finally {
      setIsPending(false);
    }
  }, [isInstalled, isPending]);

  // Auto-authenticate on load when MiniKit is ready
  useEffect(() => {
    if (isInstalled === true && !hasAttemptedAuth.current) {
      hasAttemptedAuth.current = true;
      setIsPending(true);
      walletAuth()
        .catch((error) => {
          console.error('Auto authentication error', error);
        })
        .finally(() => {
          setIsPending(false);
        });
    }
  }, [isInstalled]);

  return (
    <LiveFeedback
      label={{
        failed: 'Failed to continue',
        pending: 'Continuing',
        success: 'Signed in',
      }}
      state={isPending ? 'pending' : undefined}
    >
      <Button
        onClick={onClick}
        disabled={isPending}
        size="lg"
        variant="primary"
      >
        Continue
      </Button>
    </LiveFeedback>
  );
};
