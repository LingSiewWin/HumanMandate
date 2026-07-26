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
  // The app id goes inside a nested `props` object, not as a direct prop — see
  // minikit-js/build/minikit-provider.d.ts. Omitting it installs MiniKit anonymously
  // and logs "App ID not provided during install" on every page load.
  return (
    <MiniKitProvider props={{ appId: process.env.NEXT_PUBLIC_APP_ID }}>
      <SessionProvider session={session}>{children}</SessionProvider>
      <ErudaProvider />
    </MiniKitProvider>
  );
}
