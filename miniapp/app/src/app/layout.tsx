import { auth } from '@/auth';
import ClientProviders from '@/providers';
import '@worldcoin/mini-apps-ui-kit-react/styles.css';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HumanMandate',
  description:
    'A spending limit for your assistant — raise with face, stop anytime.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <ClientProviders session={session}>{children}</ClientProviders>
      </body>
    </html>
  );
}
