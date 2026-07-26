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
 * The two beats that carry the whole argument, lifted into the hero by index so the
 * hashes stay the imported literals. Rows 02 and 03 of the evidence list below.
 */
const HERO_PROOFS: readonly DemoBeat[] = [demoBeats[1], demoBeats[2]];

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
              <span className={styles.chip}>{TOTAL_TX} transactions</span>
            </span>
          </nav>

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
