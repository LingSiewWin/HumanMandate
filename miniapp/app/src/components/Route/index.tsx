'use client';

import { useCallback, useEffect, useState } from 'react';
import { explorerAddress, explorerTx } from '@/lib/mandate';
import {
  QUOTED_OUT,
  RECEIVED_OUT,
  ROUTE_PAYEE,
  SWAP_MANDATE_ID,
  TOKEN_IN,
  TOKEN_OUT,
  swapProofs,
  type RouteView,
} from '@/lib/swapper';
import styles from './Route.module.css';

type RoutePanelProps = {
  /** Payer whose declared route to read. Undefined until the wallet resolves. */
  wallet?: string;
  /** Bumped by the parent after a write, so the panel re-reads the chain. */
  refreshKey?: number;
};

function short(addr?: string): string {
  if (!addr || addr.length < 12) return addr ?? '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Base units to a readable figure, e.g. 939042 at 6 decimals. */
function formatUnits(raw: string, decimals: number): string {
  try {
    const v = BigInt(raw);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = v / base;
    const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  } catch {
    return raw;
  }
}

export function RoutePanel({ wallet, refreshKey = 0 }: RoutePanelProps) {
  const [route, setRoute] = useState<RouteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!wallet) return;
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch(`/api/route-config/${wallet}?mandateId=${SWAP_MANDATE_ID}`, {
        cache: 'no-store',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail ?? body?.error ?? `HTTP ${res.status}`);
      setRoute(body.route as RouteView);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!wallet) return null;

  return (
    <section className={styles.shell} aria-label="Payout route">
      <div className={styles.head}>
        <h2 className={styles.title}>Payout route</h2>
        {route?.set && <span className={styles.badge}>Route declared</span>}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading && !error && <div className={styles.skeleton} aria-hidden />}

      {!loading && !error && route && !route.set && (
        <p className={styles.empty}>No route declared</p>
      )}

      {!loading && !error && route?.set && (
        <ol className={styles.flow}>
          <li className={styles.step}>
            <span className={styles.stepLabel}>Spends</span>
            <span className={styles.stepValue}>{TOKEN_IN.symbol}</span>
            <span className={styles.stepNote}>{short(TOKEN_IN.address)}</span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepLabel}>Converts via</span>
            <span className={styles.stepValue}>Uniswap</span>
            <span className={styles.stepNote}>routed off-chain, settled on-chain</span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepLabel}>Pays</span>
            <span className={styles.stepValue}>{TOKEN_OUT.symbol}</span>
            <span className={styles.stepNote}>
              to{' '}
              <a
                className={styles.link}
                href={explorerAddress(ROUTE_PAYEE)}
                target="_blank"
                rel="noreferrer"
              >
                {short(ROUTE_PAYEE)}
              </a>
            </span>
          </li>
        </ol>
      )}

      <div className={styles.proof}>
        <h3 className={styles.proofTitle}>Proved on-chain</h3>
        <ul className={styles.list}>
          {swapProofs.map((p) => (
            <li
              key={p.tx}
              className={`${styles.row} ${p.refused ? styles.rowRefused : ''}`}
            >
              <span
                className={`${styles.dot} ${
                  p.refused ? styles.dotRefused : styles.dotOk
                }`}
                aria-hidden
              />
              <div className={styles.body}>
                <p className={styles.rowTitle}>{p.label}</p>
                {p.selector && <p className={styles.selector}>{p.selector}</p>}
                <p className={styles.meta}>
                  <a
                    className={styles.link}
                    href={explorerTx(p.tx)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {short(p.tx)}
                  </a>
                </p>
              </div>
              <span
                className={`${styles.state} ${
                  p.refused ? styles.stateRefused : styles.stateOk
                }`}
              >
                {p.refused ? 'Refused' : 'Settled'}
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.figures}>
          Quoted {formatUnits(QUOTED_OUT, TOKEN_OUT.decimals)} · paid{' '}
          {formatUnits(RECEIVED_OUT, TOKEN_OUT.decimals)} {TOKEN_OUT.symbol}
        </p>
      </div>
    </section>
  );
}
