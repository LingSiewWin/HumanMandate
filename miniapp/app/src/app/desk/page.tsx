import {
  AGENTBOOK_ADDRESS,
  MANDATE_ADDRESS,
  REGISTRY_ADDRESS,
  explorerAddress,
  explorerTx,
  demoBeats,
  type DemoBeat,
} from '@/lib/mandate';
import {
  QUOTED_OUT,
  RECEIVED_OUT,
  REFUSED_FLOOR,
  SWAPPER_ADDRESS,
  swapProofs,
} from '@/lib/swapper';
import { scenarios } from '@/lib/scenarios';
import type { Metadata } from 'next';
import styles from './desk.module.css';

export const metadata: Metadata = {
  title: 'HumanMandate — an allowance bound to a person, not an address',
  description:
    'Daily limit, locked payee, one-tap stop — bound to a person on World, not a disposable wallet.',
};

const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? 'app_0e123e45e449778a4ddb154d1fa4d24c';

/**
 * World's Quick Action deep link. `path` is URL-encoded per the docs and lands the
 * visitor on the card itself rather than the app's default screen.
 *
 * The host is `world.org` because that is what MiniKit's own `getMiniAppUrl` builds;
 * one World docs page uses `worldcoin.org` for the same link, and both resolve, but
 * the SDK is the more reliable source than the prose.
 */
const DEEPLINK = `https://world.org/mini-app?app_id=${APP_ID}&path=${encodeURIComponent('/home')}`;

/** Never retype a hash — always derive the display form from the imported literal. */
function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/** Two-digit row number, so the evidence lists stay aligned as they pass ten. */
function rowNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** Read-only board for laptops and the judging screen. No auth, no wallet, no writes. */
export default function DeskPage() {
  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <nav className={styles.nav} aria-label="Summary">
            <span className={styles.navBrand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/world-offwhite.svg"
                alt=""
                width={26}
                height={26}
                className={styles.logo}
              />
              <span className={styles.brandName}>HumanMandate</span>
            </span>
            <span className={styles.navChips}>
              <span className={styles.chip}>World Chain mainnet</span>
              <span className={styles.chip}>16 transactions</span>
            </span>
          </nav>

          <h1 className={styles.headline}>An allowance bound to a person, not an address.</h1>
          <p className={styles.deck}>
            Daily limit, one locked payee, one tap to stop — bound to a person on World, not to a
            wallet address they can throw away and replace.
          </p>

          <div className={styles.heroActions}>
            <a className={styles.cta} href={DEEPLINK} target="_blank" rel="noreferrer">
              Open in World App
            </a>
            <a className={styles.ctaGhost} href="#evidence">
              Skip to the evidence
            </a>
          </div>

          <p className={styles.attribution}>
            Every link on this page resolves to a transaction already mined on World Chain
            mainnet. Nothing here is a screenshot, a mock or a testnet run.
          </p>
        </div>
      </div>

      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.eyebrow}>Who it&rsquo;s for</p>
          <h2 className={styles.sectionTitle}>Three people, three refusals</h2>
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
                  <span className={styles.cardProofLabel}>{s.proofLabel}</span>
                  <span className={styles.cardProofHash}>{shortHash(s.proofTx)}</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} id="evidence">
          <p className={styles.eyebrow}>The run — 11 transactions</p>
          <h2 className={styles.sectionTitle}>Every rule, on World Chain mainnet</h2>
          <p className={styles.sectionNote}>
            One person, one contract, one run. The beats that cannot be reproduced by gating an
            HTTP endpoint or reissuing a card are the pair in the middle: an address the card
            never named spends, and an address with no human behind it is refused.
          </p>
          <ol className={styles.beats}>
            {demoBeats.map((b: DemoBeat, i: number) => (
              <li key={b.tx} className={styles.beat}>
                <span className={styles.beatIndex}>{rowNumber(i)}</span>
                <span className={styles.beatMain}>
                  <span className={styles.beatLabel}>{b.label}</span>
                  {b.selector ? <span className={styles.beatSelector}>{b.selector}</span> : null}
                </span>
                <span className={styles.beatSide}>
                  <span className={b.ok ? styles.statePass : styles.stateFail}>
                    <span aria-hidden="true" className={styles.stateGlyph}>
                      {b.ok ? '✓' : '✕'}
                    </span>
                    {b.ok ? 'Confirmed' : 'Reverted'}
                  </span>
                  <a
                    className={styles.beatLink}
                    href={explorerTx(b.tx)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortHash(b.tx)}
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section}>
          <p className={styles.eyebrow}>Uniswap — 5 transactions</p>
          <h2 className={styles.sectionTitle}>
            A ceiling on what goes out is not enough once there is a swap in the middle
          </h2>
          <p className={styles.sectionNote}>
            A daily cap counts what <em>leaves</em> the payer. Put a swap between the agent and
            the payee and the cap stops protecting anything: an agent can stay under it forever
            and still drain value by routing through a bad pool, because the cap never looks at
            what comes back. So the contract is given a floor, and it measures the amount the
            payee actually receives. A cap with no floor on the output is not a cap.
          </p>
          <p className={styles.sectionNote}>
            The route is a real Uniswap Trading API response — CLASSIC routing, 1054 bytes of
            calldata. The transaction that matters is the fourth one: the contract refusing to
            settle.
          </p>
          <ol className={styles.beats}>
            {swapProofs.map((b, i) => (
              <li key={b.tx} className={styles.beat}>
                <span className={styles.beatIndex}>{rowNumber(i)}</span>
                <span className={styles.beatMain}>
                  <span className={styles.beatLabel}>{b.label}</span>
                  {b.selector ? <span className={styles.beatSelector}>{b.selector}</span> : null}
                </span>
                <span className={styles.beatSide}>
                  <span className={b.refused ? styles.stateFail : styles.statePass}>
                    <span aria-hidden="true" className={styles.stateGlyph}>
                      {b.refused ? '✕' : '✓'}
                    </span>
                    {b.refused ? 'Refused' : 'Settled'}
                  </span>
                  <a
                    className={styles.beatLink}
                    href={explorerTx(b.tx)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortHash(b.tx)}
                  </a>
                </span>
              </li>
            ))}
          </ol>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Route could pay</span>
              <span className={styles.statValue}>{QUOTED_OUT}</span>
              <span className={styles.statUnit}>base units quoted</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Floor demanded &mdash; refused</span>
              <span className={styles.statValue}>{REFUSED_FLOOR}</span>
              <span className={styles.statUnit}>base units required</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Paid to the payee</span>
              <span className={styles.statValue}>{RECEIVED_OUT}</span>
              <span className={styles.statUnit}>base units received</span>
            </div>
          </div>
          <p className={styles.sectionNote}>
            Every other swap demo ends in a successful swap; this one is worth more because it
            ends in a refused one.
          </p>
        </section>

        <section className={styles.section}>
          <p className={styles.eyebrow}>Honest limits</p>
          <h2 className={styles.sectionTitle}>Three things we do not claim</h2>
          <ul className={styles.limits}>
            <li className={styles.limit}>
              World&rsquo;s AgentBook lets any Orb-verified person overwrite a binding. This raises
              the cost of a clean identity; it does not make respawning impossible.
            </li>
            <li className={styles.limit}>
              World App clears ERC-20 approvals after every transaction, so it cannot hold a
              standing one. The App is the remote control; the spending account sits outside it.
            </li>
            <li className={styles.limit}>
              The face check is reauthentication for raising a limit or moving the payee — it is
              not Proof of Human, and routine spending under the limit never asks for it.
            </li>
          </ul>
        </section>

        <footer className={styles.footer}>
          <p className={styles.eyebrow}>Contracts</p>
          <div className={styles.contracts}>
            <div className={styles.contract}>
              <span className={styles.contractLabel}>Mandate</span>
              <a
                className={styles.contractLink}
                href={explorerAddress(MANDATE_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {MANDATE_ADDRESS}
              </a>
            </div>
            <div className={styles.contract}>
              <span className={styles.contractLabel}>Swapper</span>
              <a
                className={styles.contractLink}
                href={explorerAddress(SWAPPER_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {SWAPPER_ADDRESS}
              </a>
            </div>
            <div className={styles.contract}>
              <span className={styles.contractLabel}>Registry</span>
              <a
                className={styles.contractLink}
                href={explorerAddress(REGISTRY_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {REGISTRY_ADDRESS}
              </a>
            </div>
            <div className={styles.contract}>
              <span className={styles.contractLabel}>World AgentBook (read, not ours)</span>
              <a
                className={styles.contractLink}
                href={explorerAddress(AGENTBOOK_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {AGENTBOOK_ADDRESS}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
