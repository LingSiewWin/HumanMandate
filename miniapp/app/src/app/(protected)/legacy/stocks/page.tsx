import { auth } from '@/auth';
import { BuyStock } from '@/components/BuyStock';
import { Page } from '@/components/PageLayout';
import { Portfolio } from '@/components/Portfolio';
import { RealAsset } from '@/components/RealAsset';
import { Verify } from '@/components/Verify';
import { TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import Link from 'next/link';

/** Demoted First Stock surface — not the submission main path. */
export default async function LegacyStocksPage() {
  const session = await auth();
  const serverWallet = session?.user.walletAddress ?? session?.user.id;

  return (
    <>
      <Page.Header className="p-0">
        <TopBar title="First Stock (legacy)" />
      </Page.Header>
      <Page.Main className="mb-16 flex flex-col items-center justify-start gap-4">
        <p className="w-full text-sm text-amber-800">
          Optional second door. Main product is{' '}
          <Link href="/home" className="underline">
            HumanMandate
          </Link>
          .
        </p>
        <Verify
          action={process.env.NEXT_PUBLIC_ACTION ?? 'first-stock-eligibility'}
          serverWallet={serverWallet}
        />
        <Portfolio serverWallet={serverWallet} />
        <BuyStock serverWallet={serverWallet} />
        <RealAsset serverWallet={serverWallet} />
      </Page.Main>
    </>
  );
}
