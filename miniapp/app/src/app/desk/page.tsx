import {
  AGENTBOOK_ADDRESS,
  MANDATE_ADDRESS,
  REGISTRY_ADDRESS,
  explorerAddress,
  explorerTx,
  demoBeats,
  type DemoBeat,
} from '@/lib/mandate';
import { QUOTED_OUT, RECEIVED_OUT, SWAPPER_ADDRESS, swapProofs } from '@/lib/swapper';
import { scenarios } from '@/lib/scenarios';
import type { Metadata } from 'next';
import styles from './desk.module.css';

export const metadata: Metadata = {
  title: 'HumanMandate — a company card for AI agents',
  description:
    'Daily limit, locked payee, one-tap stop — bound to a person on World, not a disposable wallet.',
};

const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? 'app_0e123e45e449778a4ddb154d1fa4d24c';
const DEEPLINK = `https://world.org/mini-app?app_id=${APP_ID}`;

/** Read-only board for laptops and the judging screen. No auth, no wallet, no writes. */
export default function DeskPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.logoRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo/world-logo-off-black.svg"
            alt=""
            width={32}
            height={32}
            className={styles.logo}
          />
          <p className={styles.brandName}>HumanMandate</p>
        </div>
        <h1 className={styles.headline}>A company card for AI agents.</h1>
        <p className={styles.deck}>
          Daily limit, one locked payee, one tap to stop — bound to a person on World, not to a
          wallet address they can throw away and replace.
        </p>
        <a className={styles.cta} href={DEEPLINK} target="_blank" rel="noreferrer">
          Open in World App
        </a>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Who it&rsquo;s for</h2>
        <p className={styles.sectionNote}>
          Design targets, not customers — we have none yet. Each one ends with the mainnet
          transaction where the chain actually performs the refusal.
        </p>
        <div className={styles.grid}>
          {scenarios.map((s) => (
            <article key={s.id} className={styles.card}>
              <p className={styles.cardTab}>{s.tab}</p>
              <h3 className={styles.cardName}>{s.person}</h3>
              <p className={styles.cardWho}>{s.who}</p>
              <p className={styles.cardPain}>{s.pain}</p>
              <p className={styles.cardSetup}>{s.setup}</p>
              <p className={styles.cardFamiliar}>{s.familiar}</p>
              <a
                className={styles.cardProof}
                href={explorerTx(s.proofTx)}
                target="_blank"
                rel="noreferrer"
              >
                {s.proofLabel}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Every rule, on World Chain mainnet</h2>
        <p className={styles.sectionNote}>
          One person, one contract, one run. The beats that cannot be reproduced by gating an
          HTTP endpoint or reissuing a card are the pair in the middle: an address the card never
          named spends, and an address with no human behind it is refused.
        </p>
        <ol className={styles.beats}>
          {demoBeats.map((b: DemoBeat, i: number) => (
            <li key={b.tx} className={styles.beat}>
              <span className={styles.beatIndex}>{i + 1}</span>
              <span className={styles.beatBody}>
                <span className={`${styles.beatLabel} ${b.ok ? '' : styles.beatFail}`}>
                  {b.label}
                </span>
                <a
                  className={styles.beatLink}
                  href={explorerTx(b.tx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {b.ok ? 'Confirmed' : 'Reverted'} · {b.tx.slice(0, 10)}…{b.tx.slice(-6)}
                </a>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          A ceiling on what goes out is not enough once there is a swap in the middle
        </h2>
        <p className={styles.sectionNote}>
          A daily cap counts what <em>leaves</em> the payer. Put a swap between the agent and the
          payee and the cap stops protecting anything: an agent can stay under it forever and
          still drain value by routing through a bad pool, because the cap never looks at what
          comes back. So the contract is given a floor, and it measures the amount the payee
          actually receives. A cap with no floor on the output is not a cap.
        </p>
        <p className={styles.sectionNote}>
          The route is a real Uniswap Trading API response — CLASSIC routing, 1054 bytes of
          calldata. The transaction that matters is the fourth one: the contract refusing to
          settle.
        </p>
        <ol className={styles.beats}>
          {swapProofs.map((b, i) => (
            <li key={b.tx} className={styles.beat}>
              <span className={styles.beatIndex}>{i + 1}</span>
              <span className={styles.beatBody}>
                <span
                  className={`${styles.beatLabel} ${b.refused ? styles.beatFail : ''}`}
                >
                  {b.label}
                  {b.selector ? ` — ${b.selector}` : ''}
                </span>
                <a
                  className={styles.beatLink}
                  href={explorerTx(b.tx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {b.refused ? 'Refused' : 'Settled'} · {b.tx.slice(0, 10)}…{b.tx.slice(-6)}
                </a>
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.sectionNote}>
          Quoted {QUOTED_OUT} base units, paid {RECEIVED_OUT}. Every other swap demo ends in a
          successful swap; this one is worth more because it ends in a refused one.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Three things we do not claim</h2>
        <ul className={styles.limits}>
          <li>
            World&rsquo;s AgentBook lets any Orb-verified person overwrite a binding. This raises the
            cost of a clean identity; it does not make respawning impossible.
          </li>
          <li>
            World App clears ERC-20 approvals after every transaction, so it cannot hold a standing
            one. The App is the remote control; the spending account sits outside it.
          </li>
          <li>
            The face check is reauthentication for raising a limit or moving the payee — it is not
            Proof of Human, and routine spending under the limit never asks for it.
          </li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <div className={styles.contract}>
          <span className={styles.contractLabel}>Mandate</span>
          <a href={explorerAddress(MANDATE_ADDRESS)} target="_blank" rel="noreferrer">
            {MANDATE_ADDRESS}
          </a>
        </div>
        <div className={styles.contract}>
          <span className={styles.contractLabel}>Swapper</span>
          <a href={explorerAddress(SWAPPER_ADDRESS)} target="_blank" rel="noreferrer">
            {SWAPPER_ADDRESS}
          </a>
        </div>
        <div className={styles.contract}>
          <span className={styles.contractLabel}>Registry</span>
          <a href={explorerAddress(REGISTRY_ADDRESS)} target="_blank" rel="noreferrer">
            {REGISTRY_ADDRESS}
          </a>
        </div>
        <div className={styles.contract}>
          <span className={styles.contractLabel}>World AgentBook (read, not ours)</span>
          <a href={explorerAddress(AGENTBOOK_ADDRESS)} target="_blank" rel="noreferrer">
            {AGENTBOOK_ADDRESS}
          </a>
        </div>
      </footer>
    </main>
  );
}
