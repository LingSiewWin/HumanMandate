import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { BuyStock } from '@/components/BuyStock';
import { UserInfo } from '@/components/UserInfo';
import { Verify } from '@/components/Verify';
import { Marble, TopBar } from '@worldcoin/mini-apps-ui-kit-react';

export default async function Home() {
  const session = await auth();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar
          title="First Stock"
          endAdornment={
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold capitalize">
                {session?.user.username}
              </p>
              <Marble src={session?.user.profilePictureUrl} className="w-12" />
            </div>
          }
        />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-4 mb-16">
        <div className="w-full">
          <p className="text-2xl font-semibold leading-tight">
            Your first stock,
            <br />
            with the money you already have.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            No bank account. No documents uploaded. One ZK proof — and the pool itself
            lets you in.
          </p>
        </div>
        <UserInfo />
        <Verify action={process.env.NEXT_PUBLIC_ACTION ?? 'first-stock-eligibility'} />
        <BuyStock />
        <div className="w-full rounded-2xl border border-dashed border-gray-300 p-4">
          <p className="text-sm font-semibold">AI auto-invest — coming next</p>
          <p className="text-xs text-gray-500">
            $2/day, spend cap enforced by the contract itself, one-tap revoke. The same
            allowlist that gates you gates your agent.
          </p>
        </div>
      </Page.Main>
    </>
  );
}
