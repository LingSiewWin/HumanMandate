import { auth } from '@/auth';
import { MandatePanel } from '@/components/Mandate';
import { Page } from '@/components/PageLayout';
import styles from './home.module.css';

export default async function Home() {
  const session = await auth();
  const serverWallet = session?.user.walletAddress ?? session?.user.id;

  return (
    <>
      {/* Top-right stays clear for World App chrome; brand lives in MandatePanel. */}
      <Page.Header className={styles.header}>
        <div className={styles.headerSafe} aria-hidden />
      </Page.Header>
      <Page.Main className={styles.main}>
        <MandatePanel serverWallet={serverWallet} />
      </Page.Main>
    </>
  );
}
