import {
  AGENTBOOK_ADDRESS,
  MANDATE_ADDRESS,
  MANDATE_CHAIN_ID,
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
  TOKEN_OUT,
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

/** Counts are derived, never typed, so the page can never disagree with the data. */
const TOTAL_TX = demoBeats.length + swapProofs.length;
const REFUSAL_TX =
  demoBeats.filter((b) => !b.ok).length + swapProofs.filter((p) => p.refused).length;

/**
 * The one number on this page that cannot be derived from the imported data: the size
 * of the Solidity suite. Source is `forge test` in `contracts/` — 48 test functions
 * across HumanMandate, MandateSwapper, StepUp, DcaLeash and the AgentBook fork test.
 */
const TESTS_PASSING = 48;

/**
 * The two beats that carry the whole argument, lifted into the hero by index so the
 * hashes stay the imported literals. Rows 02 and 03 of the evidence list below.
 */
const HERO_PROOFS: readonly DemoBeat[] = [demoBeats[1], demoBeats[2]];

/** Source and contact. Quiet footer text, deliberately not a call to action. */
const COLOPHON_LINKS: readonly { readonly label: string; readonly href: string }[] = [
  { label: 'Source', href: 'https://github.com/LingSiewWin/HumanMandate' },
  { label: 'X', href: 'https://x.com/siewwwin' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ling-siew-win/' },
  { label: 'Telegram', href: 'https://t.me/siewwwin' },
];

type Surface = {
  readonly art: string;
  readonly tag: string;
  readonly name: string;
  readonly note: string;
  /** Set in the hash face beneath the note, the same way selectors are. */
  readonly call?: string;
};

/**
 * The three surfaces the card actually stands on. Each claim below is either performed
 * by a transaction in the lists above or restated verbatim from the honest-limits
 * section beneath — no capability is described here that the page cannot show.
 */
const SURFACES: readonly Surface[] = [
  {
    art: '/brand/illus/world-id.webp',
    tag: 'World ID',
    name: 'Selfie Check',
    note: 'Liveness is asked only where authority widens — raising a cap, or moving the payee. Spending under the limit never triggers it. It is reauthentication before a rule changes, not a proof that anyone is human.',
  },
  {
    art: '/brand/illus/world-chain.webp',
    tag: 'World Chain',
    name: 'AgentBook',
    note: 'Before it moves anything, the payment contract asks World’s registry which person is behind the address, so the rule binds the human rather than the key. Every project listed on agentbook.world gates an HTTP endpoint; none of them guards money in Solidity.',
    call: 'lookupHuman(address)',
  },
  {
    art: '/brand/illus/world-coin.webp',
    tag: 'Uniswap',
    name: 'Trading API',
    note: 'The venue the allowance is actually spent at. The floor on what the payee receives is enforced on-chain, so a cap that only counts what leaves cannot be drained through a bad route.',
  },
];

type HandoffBeat = { readonly title: string; readonly note: string };

/**
 * The opening section is the product in three sentences. Nothing here is a promise:
 * each clause is performed by a transaction further down — the cap and the payment
 * ceiling by row 01, the unattended spend by row 02, the stop and the respawn refusal
 * by rows 10 and 11.
 */
const HANDOFF_BEATS: readonly HandoffBeat[] = [
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
];

/** Never retype a hash — always derive the display form from the imported literal. */
function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/** Two-digit row number, so the evidence lists stay aligned as they pass ten. */
function rowNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * Base units to a human amount. The swap figures are USDC.e, and six decimals is the
 * difference between "939042" and "0.939042" — the decimals come from the token
 * constant rather than a second copy of the numbers.
 */
function toUnits(baseUnits: string, decimals: number): string {
  const padded = baseUnits.padStart(decimals + 1, '0');
  const cut = padded.length - decimals;
  return `${padded.slice(0, cut)}.${padded.slice(cut)}`;
}

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
                width={26}
                height={26}
                className={styles.logo}
              />
              <span className={styles.brandName}>HumanMandate</span>
            </span>
            <span className={styles.navChips}>
              <span className={styles.chip}>World Chain mainnet</span>
              <span className={styles.chip}>{TOTAL_TX} transactions</span>
            </span>
          </nav>

          <div className={styles.handoffContent}>
            <p className={styles.handoffKicker}>The handoff</p>
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

          <p className={styles.handoffCue}>
            <span aria-hidden="true" className={styles.handoffCueArrow} />
            {TOTAL_TX} mainnet transactions below
          </p>
        </div>
      </section>

      <div className={styles.hero}>
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
          <p className={styles.eyebrow}>
            {REFUSAL_TX} of these {TOTAL_TX} transactions are refusals — that is the product
          </p>
          <h2 className={styles.sectionTitle}>Every rule, on World Chain mainnet</h2>
          <p className={styles.sectionNote}>
            One person, one contract, one run. The two beats that cannot be reproduced by gating
            an HTTP endpoint or reissuing a card are rows 02 and 03: an address the card never
            named spends anyway, and a wallet with no human behind it is refused.
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
          <div className={styles.settlement}>
            <p className={styles.settlementLine}>
              The route could deliver{' '}
              <span className={styles.settleFigure}>
                {toUnits(QUOTED_OUT, TOKEN_OUT.decimals)} {TOKEN_OUT.symbol}
              </span>
              ; the contract demanded{' '}
              <span className={`${styles.settleFigure} ${styles.settleRefused}`}>
                {toUnits(REFUSED_FLOOR, TOKEN_OUT.decimals)}
              </span>
              , refused, then settled at{' '}
              <span className={`${styles.settleFigure} ${styles.settleReceived}`}>
                {toUnits(RECEIVED_OUT, TOKEN_OUT.decimals)} received
              </span>
              .
            </p>
            <p className={styles.settlementRaw}>
              base units — quoted {QUOTED_OUT} · floor {REFUSED_FLOOR} · received {RECEIVED_OUT}
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.eyebrow}>What it is built on</p>
          <h2 className={styles.sectionTitle}>Three surfaces, three jobs</h2>
          <p className={styles.sectionNote}>
            Nothing here is an integration for its own sake. Each surface does one thing the
            other two cannot, and the transactions above are what happens when they are wired
            together.
          </p>
          <div className={styles.grid}>
            {SURFACES.map((s) => (
              <article key={s.name} className={`${styles.card} ${styles.surface}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.art}
                  alt=""
                  width={88}
                  height={88}
                  loading="lazy"
                  className={styles.surfaceMark}
                />
                <p className={styles.cardTab}>{s.tag}</p>
                <h3 className={styles.cardName}>{s.name}</h3>
                <p className={styles.surfaceNote}>{s.note}</p>
                {s.call ? <p className={styles.surfaceCall}>{s.call}</p> : null}
              </article>
            ))}
          </div>
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
          {/* Four numbers, three of them derived from the same data the lists render. */}
          <ul className={styles.stats}>
            <li className={styles.stat}>
              <span className={styles.statValue}>{TOTAL_TX}</span>
              <span className={styles.statLabel}>mainnet transactions</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{REFUSAL_TX}</span>
              <span className={styles.statLabel}>of them refusals</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{TESTS_PASSING}</span>
              <span className={styles.statLabel}>tests passing</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{MANDATE_CHAIN_ID}</span>
              <span className={styles.statLabel}>World Chain chain id</span>
            </li>
          </ul>

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
