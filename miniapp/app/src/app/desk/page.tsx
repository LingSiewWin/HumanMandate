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
  SWAPPER_ADDRESS,
  swapProofs,
} from '@/lib/swapper';
import type { Metadata } from 'next';
import styles from './desk.module.css';

export const metadata: Metadata = {
  title: 'HumanMandate — an allowance bound to a person, not an address',
  description:
    'Daily limit, locked payee, one-tap stop — bound to a person on World, not a disposable wallet.',
};

const APP_ID = process.env.NEXT_PUBLIC_APP_ID ?? 'app_0e123e45e449778a4ddb154d1fa4d24c';

/**
 * World's Quick Action deep link. `path` is URL-encoded per the docs, so the visitor
 * lands on the card rather than the app's default screen.
 */
const DEEPLINK = `https://world.org/mini-app?app_id=${APP_ID}&path=${encodeURIComponent('/home')}`;

/** Never retype a hash — always derive the display form from the imported literal. */
function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/** Two-digit row number, so the beats stay aligned. */
function rowNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

const HANDOFF_BEATS = [
  {
    title: 'You set the limit',
    note: 'A rolling 24-hour cap, a ceiling on any single payment, and one payee the agent cannot swap out.',
  },
  {
    title: 'It spends without you',
    note: 'The agent pays with nobody present — no approval pop-up, no key handed over. The limit is the only thing in the way.',
  },
  {
    title: 'You stop the person',
    note: 'One tap ends it, and a brand-new address from that same human is refused on the next block.',
  },
] as const;

/** The two that carry the whole argument: one accepted, one refused, same call. */
const HERO_PROOFS: readonly DemoBeat[] = [demoBeats[1], demoBeats[2]];


const SURFACES: readonly {
  tag: string;
  name: string;
  art: string;
  note: string;
  call?: string;
}[] = [
  {
    tag: 'World ID',
    name: 'Selfie Check',
    art: '/brand/illus/world-id.webp',
    note:
      'Liveness is asked only where authority widens — raising a cap, or moving the payee. ' +
      'Spending under the limit never triggers it. It is reauthentication before a rule ' +
      'changes, not a proof that anyone is human.',
  },
  {
    tag: 'World Chain',
    name: 'AgentBook',
    art: '/brand/illus/world-chain.webp',
    note:
      'Before it moves anything, the payment contract asks World’s registry which person is ' +
      'behind the address, so the rule binds the human rather than the key. Every project ' +
      'listed on agentbook.world gates an HTTP endpoint; none of them guards money in Solidity.',
    call: 'lookupHuman(address)',
  },
  {
    tag: 'Uniswap',
    name: 'Trading API',
    art: '/brand/illus/world-coin.webp',
    note:
      'The venue the allowance is actually spent at. The floor on what the payee receives is ' +
      'enforced on-chain, so a cap that only counts what leaves cannot be drained through a ' +
      'bad route.',
  },
] as const;

const COLOPHON_LINKS = [
  { href: 'https://github.com/LingSiewWin/HumanMandate', label: 'Repository' },
  { href: 'https://x.com/siewwwin', label: 'X' },
  { href: 'https://www.linkedin.com/in/ling-siew-win/', label: 'LinkedIn' },
  { href: 'https://t.me/siewwwin', label: 'Telegram' },
] as const;

/** Read-only board for laptops and the judging screen. No auth, no wallet, no writes. */
export default function DeskPage() {
  return (
    <main className={styles.page}>
      {/*
        Section 1 — the handoff. The artwork behind it is the literal subject: a human
        hand and a machine hand, fingertips almost touching. It ships black-on-white,
        so the layer below inverts it to sit on the ink field; the inversion is on its
        own absolutely-positioned layer so it never touches the type.
      */}
      <section className={styles.handoff} aria-label="What the card does">
        <div className={styles.handoffArt} aria-hidden="true" />
        <div className={styles.handoffScrim} aria-hidden="true" />

        <div className={styles.handoffInner}>
          <nav className={styles.nav} aria-label="Summary">
            <span className={styles.navBrand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/world-offwhite.svg"
                alt=""
                width={96}
                height={96}
                className={styles.logo}
              />
            </span>
            <span className={styles.navChips}>
              <span className={styles.chip}>World Chain mainnet</span>
            </span>
          </nav>

          <div className={styles.handoffContent}>
            <p className={styles.wordmark}>HumanMandate</p>
            <p className={styles.wordmarkNote}>
              An allowance bound to a person, not an address.
            </p>
            <ol className={styles.handoffBeats}>
              {HANDOFF_BEATS.map((b, i) => (
                <li key={b.title} className={styles.handoffBeat}>
                  <span className={styles.handoffBeatIndex}>{rowNumber(i)}</span>
                  <span className={styles.handoffBeatTitle}>{b.title}</span>
                  <span className={styles.handoffBeatNote}>{b.note}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.handoffActions}>
            <a className={styles.openApp} href={DEEPLINK} target="_blank" rel="noreferrer">
              Open in World App
            </a>
            <a className={styles.handoffCue} href="#evidence">
              <span aria-hidden="true" className={styles.handoffCueArrow} />
              See the two that decide it
            </a>
          </div>
        </div>
      </section>

      <div className={styles.hero} id="evidence">
        <div className={styles.heroInner}>
          <div className={styles.heroGrid}>
            <div className={styles.heroClaim}>
              <h1 className={styles.headline}>An allowance bound to a person, not an address.</h1>
              <p className={styles.deck}>
                Daily limit, one locked payee, one tap to stop — bound to a person on World, not
                to a wallet address they can throw away and replace.
              </p>

              <div className={styles.heroActions}>
                <a className={styles.cta} href="#evidence">
                  Skip to the evidence
                </a>
                <a
                  className={styles.ctaGhost}
                  href={DEEPLINK}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in World App
                </a>
              </div>

              <p className={styles.attribution}>
                Every link on this page resolves to a transaction already mined on World Chain
                mainnet. Nothing here is a screenshot, a mock or a testnet run.
              </p>
            </div>

            <aside className={styles.heroProof} aria-label="The two transactions that decide it">
              <p className={styles.heroProofTitle}>The two that decide it</p>
              <ul className={styles.heroProofList}>
                {HERO_PROOFS.map((b) => (
                  <li key={b.tx} className={styles.heroProofItem}>
                    <span className={styles.heroProofLabel}>{b.label}</span>
                    <span className={styles.heroProofMeta}>
                      <span className={b.ok ? styles.heroStatePass : styles.heroStateFail}>
                        <span aria-hidden="true" className={styles.stateGlyph}>
                          {b.ok ? '✓' : '✕'}
                        </span>
                        {b.ok ? 'Confirmed' : 'Reverted'}
                      </span>
                      <a
                        className={styles.heroProofLink}
                        href={explorerTx(b.tx)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortHash(b.tx)}
                      </a>
                    </span>
                    {b.selector ? (
                      <span className={styles.heroProofSelector}>{b.selector}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </div>

      <div className={styles.body}>


        <section className={styles.section}>
          <p className={styles.eyebrow}>Uniswap — {swapProofs.length} transactions</p>
          <h2 className={styles.sectionTitle}>A cap with no floor is not a cap.</h2>
          <p className={styles.sectionNote}>
            A daily cap only counts what <em>leaves</em> the payer, so an agent can stay under it
            forever and still drain value by routing through a bad pool. The contract is given a
            floor instead, and it measures the amount the payee actually receives.
          </p>
          <p className={styles.sectionNote}>
            The route is a real Uniswap Trading API response — CLASSIC routing, 1054 bytes of
            calldata. The transaction that matters is the fourth one: the contract refusing to
            settle.
          </p>
        </section>

      </div>

      {/*
        Section 3 — the three surfaces, one screen each.

        The stack is a plain CSS sticky sequence: every panel is `position: sticky;
        top: 0` inside one container, so the first pins while the second and third
        slide over it. No script, no scroll listener. Each panel is opaque, or the
        one underneath would print through. The container sits outside `.body` so a
        panel can run the full width of the viewport without a 100vw negative-margin
        trick, which is what usually introduces a horizontal scrollbar.
      */}
      <section className={styles.surfaces}>
        <div className={styles.surfacesIntro}>
          <p className={styles.eyebrow}>What it is built on</p>
          <h2 className={styles.sectionTitle}>Three surfaces, three jobs</h2>
          <p className={styles.sectionNote}>
            Nothing here is an integration for its own sake. Each surface does one thing the
            other two cannot, and the transactions above are what happens when they are wired
            together.
          </p>
        </div>

        <div className={styles.surfaceStack}>
          {SURFACES.map((s) => (
            <article key={s.name} className={styles.surfacePanel}>
              <div className={styles.surfacePanelInner}>
                <p className={styles.surfaceTag}>{s.tag}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.art}
                  alt=""
                  width={176}
                  height={176}
                  loading="lazy"
                  className={styles.surfaceMark}
                />
                <h3 className={styles.surfaceName}>{s.name}</h3>
                <p className={styles.surfaceNote}>{s.note}</p>
                {s.call ? <p className={styles.surfaceCall}>{s.call}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.body}>
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
          {/* Four numbers, three of them derived from the same data the lists render. */}

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

          {/* Contact, not a call to action — the same weight as the contract labels. */}
          <p className={styles.colophon}>
            {COLOPHON_LINKS.map((l, i) => (
              <span key={l.href} className={styles.colophonItem}>
                {i > 0 ? (
                  <span aria-hidden="true" className={styles.colophonDot}>
                    ·
                  </span>
                ) : null}
                <a
                  className={styles.colophonLink}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {l.label}
                </a>
              </span>
            ))}
          </p>
        </footer>
      </div>
    </main>
  );
}
