'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ActivityItem } from '@/lib/activity';
import { DEMO_TOKEN_ADDRESS, DEMO_TOKEN_SYMBOL, explorerTx } from '@/lib/mandate';
import { TOKEN_IN, TOKEN_OUT } from '@/lib/swapper';
import styles from './Activity.module.css';

type ActivityFeedProps = {
  /** Payer whose mandate history to show. Undefined until the wallet resolves. */
  wallet?: string;
  /** Bumped by the parent after a write, so the feed re-reads the chain. */
  refreshKey?: number;
};

/**
 * Keep small amounts legible. Truncating to two decimals turned a real 0.0005 WETH
 * charge into "0.00", which reads as though nothing was spent, so the fraction is
 * kept until it carries two significant digits.
 */
function formatAmount(raw: string, decimals = 18): string {
  const negative = raw.startsWith('-');
  const digits = (negative ? raw.slice(1) : raw).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, '');
  let shown = whole;
  if (frac) {
    const leadingZeros = frac.length - frac.replace(/^0+/, '').length;
    shown = `${whole}.${frac.slice(0, leadingZeros + 2)}`;
  }
  return negative ? `-${shown}` : shown;
}

/** The feed spans several mandates, and they do not all spend the same token. */
function tokenLabel(token?: string): { symbol: string; decimals: number } {
  const at = (token ?? '').toLowerCase();
  if (at === TOKEN_IN.address.toLowerCase()) return TOKEN_IN;
  if (at === TOKEN_OUT.address.toLowerCase()) return TOKEN_OUT;
  if (at === DEMO_TOKEN_ADDRESS.toLowerCase()) {
    return { symbol: DEMO_TOKEN_SYMBOL, decimals: 18 };
  }
  return { symbol: '', decimals: 18 };
}

function short(addr?: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const dotClass: Record<ActivityItem['kind'], string> = {
  pulled: styles.dotPulled,
  authorized: styles.dotAuthorized,
  revoked: styles.dotRevoked,
  raised: styles.dotRaised,
};

export function ActivityFeed({ wallet, refreshKey = 0 }: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!wallet) return;
    setError(undefined);
    try {
      const res = await fetch(`/api/activity/${wallet}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail ?? body?.error ?? `HTTP ${res.status}`);
      setItems(body.items as ActivityItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!wallet) return null;

  return (
    <section className={styles.shell} aria-label="Card activity">
      <div className={styles.head}>
        <h2 className={styles.title}>Activity</h2>
        {items && items.length > 0 && (
          <span className={styles.count}>
            {items.length} {items.length === 1 ? 'event' : 'events'} on-chain
          </span>
        )}
      </div>

      {error && (
        <p className={styles.error}>
          Could not read the chain: {error}. The feed shows only what the contract
          actually recorded, so nothing is filled in from memory.
        </p>
      )}

      {items === null && !error && <div className={styles.skeleton} aria-hidden />}

      {items && items.length === 0 && !error && (
        <p className={styles.empty}>
          Nothing yet. Once you create a card and your assistant spends on it, every
          charge lands here — read back from World Chain, not from this app&apos;s memory.
        </p>
      )}

      {items && items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={`${item.txHash}-${item.kind}`} className={styles.row}>
              <span className={`${styles.dot} ${dotClass[item.kind]}`} aria-hidden />
              <div className={styles.body}>
                <p className={styles.rowTitle}>{item.title}</p>
                <p className={styles.rowDetail}>{item.detail}</p>
                <p className={styles.meta}>
                  {item.agent && <>spent by {short(item.agent)} · </>}
                  {item.recipient && <>paid {short(item.recipient)} · </>}
                  <a
                    className={styles.link}
                    href={explorerTx(item.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {short(item.txHash)}
                  </a>
                </p>
              </div>
              {item.amount && (
                <span
                  className={`${styles.amount} ${
                    item.kind === 'pulled' ? '' : styles.amountMuted
                  }`}
                >
                  {item.kind === 'pulled' ? '−' : ''}
                  {formatAmount(item.amount, tokenLabel(item.token).decimals)}{' '}
                  {tokenLabel(item.token).symbol}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
