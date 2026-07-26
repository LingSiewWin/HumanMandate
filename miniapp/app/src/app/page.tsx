import { Page } from '@/components/PageLayout';
import { AuthButton } from '../components/AuthButton';
import styles from './login.module.css';

export default function Home() {
  return (
    <Page className={styles.page}>
      <Page.Main className={styles.main}>
        <div className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo/world-logo-off-black.svg"
            alt=""
            width={40}
            height={40}
            className={styles.logo}
          />
          <p className={styles.brand}>HumanMandate</p>
          <h1 className={styles.title}>A spending limit for your assistant</h1>
          <p className={styles.sub}>
            Daily limit. Locked payee. Raise with face. Stop anytime.
          </p>
        </div>
        <div className={styles.cta}>
          <AuthButton />
        </div>
      </Page.Main>
    </Page>
  );
}
