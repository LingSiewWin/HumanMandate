import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { SpendingPanel } from '@/components/Spending';
import styles from './spending.module.css';

export default async function Spending() {
  const session = await auth();
  const serverWallet = session?.user.walletAddress ?? session?.user.id;

  return (
    <>
      {/* Top-right stays clear for World App chrome, as on the Mandate tab. */}
      <Page.Header className={styles.header}>
        <div className={styles.headerSafe} aria-hidden />
      </Page.Header>
      <Page.Main className={styles.main}>
        <SpendingPanel serverWallet={serverWallet} />
      </Page.Main>
    </>
  );
}
