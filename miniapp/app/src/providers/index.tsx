'use client';
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const ErudaProvider = dynamic(
  () => import('@/providers/Eruda').then((c) => c.ErudaProvider),
  { ssr: false },
);

// Define props for ClientProviders
interface ClientProvidersProps {
  children: ReactNode;
  session: Session | null; // Use the appropriate type for session from next-auth
}

/**
 * ClientProvider wraps the app with essential context providers.
 *
 * - MiniKitProvider:
 *     - Required for MiniKit functionality.
 *
 * - ErudaProvider (dev only):
 *     - In-browser console for debugging inside the World App webview.
 *     - Mounted as a sibling: it loads with `ssr: false`, and wrapping the tree
 *       in it would bail the whole app out of SSR (blank first paint on phones).
 */
export default function ClientProviders({
  children,
  session,
}: ClientProvidersProps) {
  return (
    <MiniKitProvider>
      <SessionProvider session={session}>{children}</SessionProvider>
      <ErudaProvider />
    </MiniKitProvider>
  );
}
