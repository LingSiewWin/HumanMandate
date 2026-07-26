'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ActivityItem } from '@/lib/activity';
import { explorerTx, type MandateView } from '@/lib/mandate';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import {
  WINDOW_SECONDS,
  ZERO,
  barVars,
  formatAgo,
  formatAmount,
  formatRemaining,
  share,
  short,
  toBigInt,
  tokenInfo,
} from './format';
import styles from './Spending.module.css';

type SpendingPanelProps = {
  /** Payer whose card to read. Undefined until the wallet resolves. */
  serverWallet?: string;
};

/** Enough rows to show the shape of recent spending without turning into a ledger. */
const MAX_CHARGES = 6;

export function SpendingPanel({ serverWallet }: SpendingPanelProps) {
  const wallet = useWalletAddress() ?? serverWallet;

  const [mandate, setMandate] = useState<MandateView | null>(null);
  const [cardId, setCardId] = useState<string | undefined>();
  const [mandateError, setMandateError] = useState<string | undefined>();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState<string | undefined>();
  // Left undefined for the first render so the server and the client agree; the clock
  // only starts once the component is mounted in the browser.
  const [now, setNow] = useState<number | undefined>();

  const loadMandate = useCallback(async () => {
    if (!wallet) return;
    setMandateError(undefined);
    try {
      const res = await fetch(`/api/mandate/${wallet}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail ?? body?.error ?? `HTTP ${res.status}`);
      setMandate(body.mandate as MandateView);
      setCardId(typeof body.mandateId === 'string' ? body.mandateId : undefined);
    } catch (e) {
      setMandateError(e instanceof Error ? e.message : String(e));
    }
  }, [wallet]);

  const loadActivity = useCallback(async () => {
    if (!wallet) return;
    setActivityError(undefined);
    try {
      const res = await fetch(`/api/activity/${wallet}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail ?? body?.error ?? `HTTP ${res.status}`);
      setItems(body.items as ActivityItem[]);
    } catch (e) {
      setActivityError(e instanceof Error ? e.message : String(e));
      setItems([]);
    }
  }, [wallet]);

  useEffect(() => {
    void loadMandate();
    void loadActivity();
  }, [loadMandate, loadActivity]);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!wallet) return null;

  const token = tokenInfo(mandate?.token);
  const cap = toBigInt(mandate?.windowCap);
  const perTxCap = toBigInt(mandate?.perTxCap);
  const windowStart = Number(mandate?.windowStart ?? '0');

  // The contract only clears spentInWindow on the next pull, so a stored figure from a
  // window that has already run out no longer applies. Reporting it would overstate the
  // spend on a card whose allowance is in fact whole again.
  const windowElapsed = now !== undefined && windowStart > 0 ? now - windowStart : 0;
  const windowExpired = windowStart === 0 || windowElapsed >= WINDOW_SECONDS;
  const storedSpent = toBigInt(mandate?.spentInWindow);
  const spent = now === undefined || !windowExpired ? storedSpent : ZERO;
  const remaining = cap > spent ? cap - spent : ZERO;

  const spentShare = share(spent, cap);
  const perTxShare = share(perTxCap, cap);

  const charges = (items ?? [])
    .filter((item) => item.kind === 'pulled' && item.amount)
    .slice(0, MAX_CHARGES);

  // Charges are scaled against the largest charge in the same token: a 0.0005 WETH bar
  // measured against a 2 DemoUSD bar would say nothing true.
  const largestByToken = new Map<string, bigint>();
  for (const item of charges) {
    const key = (item.token ?? '').toLowerCase();
    const amount = toBigInt(item.amount);
    if (amount > (largestByToken.get(key) ?? ZERO)) largestByToken.set(key, amount);
  }

  const hasCard = mandate !== null && !mandate.empty;

  return (
    <section className={styles.shell} aria-label="Spending">
      <header className={styles.head}>
        <h1 className={styles.title}>Spending</h1>
        <p className={styles.lede}>
          Every figure below is read from the card on World Chain. Nothing is estimated.
        </p>
      </header>

      {mandateError && (
        <p className={styles.error}>
          Could not read the card: {mandateError}. No allowance is shown rather than a
          guessed one.
        </p>
      )}

      {mandate === null && !mandateError && <div className={styles.skeleton} aria-hidden />}

      {mandate !== null && mandate.empty && (
        <p className={styles.empty}>
          There is no card on this wallet yet, so there is nothing to spend. Create one on
          the Mandate tab and the allowance will appear here.
        </p>
      )}

      {hasCard && (
        <>
          <div className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.blockTitle}>Today&apos;s allowance</h2>
              {!mandate.active && <span className={styles.flag}>Stopped</span>}
            </div>

            <p className={styles.figure}>
              <span className={styles.hero}>{formatAmount(spent, token.decimals)}</span>
              {token.symbol && <span className={styles.heroUnit}>{token.symbol}</span>}
              <span className={styles.figureLabel}>
                spent of {formatAmount(cap, token.decimals)}
                {token.symbol ? ` ${token.symbol}` : ''}
              </span>
            </p>

            <div
              className={styles.track}
              role="img"
              aria-label={`${formatAmount(spent, token.decimals)} of ${formatAmount(
                cap,
                token.decimals,
              )} ${token.symbol} spent in this window`}
            >
              {spentShare > 0 && (
                <div className={styles.fillAccent} style={barVars(spentShare, 80)} />
              )}
              {perTxShare > 0 && perTxShare < 100 && (
                <span
                  className={styles.marker}
                  style={{ left: `${perTxShare}%` }}
                  aria-hidden
                />
              )}
            </div>

            <p className={styles.scale}>
              <span>0</span>
              <span>
                {formatAmount(remaining, token.decimals)}
                {token.symbol ? ` ${token.symbol}` : ''} left
              </span>
            </p>

            <div className={styles.secondary}>
              <div className={styles.trackThin} aria-hidden>
                <div className={styles.fillQuiet} style={barVars(perTxShare, 200)} />
              </div>
              <span className={styles.mid}>{formatAmount(perTxCap, token.decimals)}</span>
              <span className={styles.secondaryLabel}>
                {perTxCap >= cap
                  ? 'one payment may take the lot'
                  : 'ceiling on any one payment'}
              </span>
            </div>
          </div>

          <div className={styles.block}>
            <h2 className={styles.blockTitle}>The window</h2>
            {now === undefined ? (
              <p className={styles.note}>Reading the clock…</p>
            ) : windowExpired ? (
              <p className={styles.note}>
                The last 24 hours have run out, so the whole allowance is available again.
                The next payment starts a fresh 24 hours from the moment it lands.
              </p>
            ) : (
              <>
                <p className={styles.figure}>
                  <span className={styles.hero}>
                    {formatRemaining(windowStart + WINDOW_SECONDS - now)}
                  </span>
                  <span className={styles.figureLabel}>until the allowance resets</span>
                </p>
                <div
                  className={styles.trackThin}
                  role="img"
                  aria-label="How much of the 24-hour window has elapsed"
                >
                  <div
                    className={styles.fillQuiet}
                    style={barVars((windowElapsed / WINDOW_SECONDS) * 100, 280)}
                  />
                </div>
                <p className={styles.note}>
                  A rolling 24 hours, not a calendar day. This one began at{' '}
                  {new Date(windowStart * 1000).toLocaleString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short',
                  })}
                  .
                </p>
              </>
            )}
          </div>
        </>
      )}

      <div className={styles.block}>
        <h2 className={styles.blockTitle}>Recent charges</h2>

        {activityError && (
          <p className={styles.error}>
            Could not read the charges: {activityError}. Nothing is drawn rather than a
            made-up bar.
          </p>
        )}

        {items === null && !activityError && <div className={styles.skeleton} aria-hidden />}

        {items !== null && charges.length === 0 && !activityError && (
          <p className={styles.empty}>
            Nothing has been charged to this wallet yet. Every charge that does land is
            read back from World Chain and appears here.
          </p>
        )}

        {charges.length > 0 && (
          <>
            <p className={styles.note}>
              Across every card on this wallet. Bars are scaled against the largest charge
              in the same token.
            </p>
            <ul className={styles.charges}>
              {charges.map((item, index) => {
                const info = tokenInfo(item.token);
                const amount = toBigInt(item.amount);
                const largest = largestByToken.get((item.token ?? '').toLowerCase()) ?? ZERO;
                const inWindow =
                  now !== undefined &&
                  !windowExpired &&
                  item.mandateId === cardId &&
                  item.timestamp !== undefined &&
                  item.timestamp >= windowStart;
                return (
                  <li key={`${item.txHash}-${index}`} className={styles.charge}>
                    <div className={styles.chargeBarCell}>
                      <div className={styles.trackThin} aria-hidden>
                        <div
                          className={inWindow ? styles.fillAccent : styles.fillQuiet}
                          style={barVars(share(amount, largest), 320 + index * 60)}
                        />
                      </div>
                    </div>
                    <span className={styles.mid}>
                      {formatAmount(amount, info.decimals)}
                      {info.symbol && <span className={styles.midUnit}> {info.symbol}</span>}
                    </span>
                    <p className={styles.chargeMeta}>
                      {inWindow && <span className={styles.tag}>this window</span>}
                      {item.timestamp !== undefined && now !== undefined && (
                        <>{formatAgo(now - item.timestamp)} · </>
                      )}
                      {item.agent && <>by {short(item.agent)} · </>}
                      <a
                        className={styles.link}
                        href={explorerTx(item.txHash)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {short(item.txHash)}
                      </a>
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
