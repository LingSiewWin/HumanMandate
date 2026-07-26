'use client';

import { useState } from 'react';
import {
  DEMO_TOKEN_SYMBOL,
  MANDATE_ADDRESS,
  MANDATE_CHAIN_ID,
  type MandateView,
} from '@/lib/mandate';
import styles from './Handoff.module.css';

type HandoffProps = {
  wallet?: string;
  mandate: MandateView | null;
};

function formatUnits(raw: string, decimals = 18): string {
  try {
    const v = BigInt(raw);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = v / base;
    const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac.slice(0, 2)}` : whole.toString();
  } catch {
    return raw;
  }
}

function short(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * The step people actually ask about: "so how do I give this to my assistant?"
 *
 * Nothing secret is handed over — that is the whole point. The assistant needs only
 * the payer address and the contract; their own registered agent addresses are what
 * the contract checks, and it checks them against the *person*, so the card cannot be
 * forwarded to anybody else by copying this text.
 */
export function Handoff({ wallet, mandate }: HandoffProps) {
  const [copied, setCopied] = useState<'brief' | undefined>();

  if (!wallet || !mandate || mandate.empty) return null;

  const live = mandate.active;
  const brief = [
    `You have been given a spending mandate on World Chain (chain ${MANDATE_CHAIN_ID}).`,
    ``,
    `Contract: ${MANDATE_ADDRESS}`,
    `Payer:    ${wallet}`,
    ``,
    `Call: pull(payer, mandateId, amount)`,
    `Any agent address you have registered in World's AgentBook can call it.`,
    `You cannot choose the payee and you cannot exceed the cap — both are fixed on-chain.`,
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied('brief');
      setTimeout(() => setCopied(undefined), 2000);
    } catch {
      // Clipboard is unavailable in some in-app webviews; the text stays selectable.
    }
  };

  return (
    <section className={styles.shell} aria-label="Hand the card over">
      <h2 className={styles.title}>Hand it to your assistant</h2>

      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.cardLabel}>HumanMandate</span>
          <span
            className={`${styles.cardState} ${live ? styles.cardStateLive : ''}`}
          >
            {live ? 'Live' : 'Stopped'}
          </span>
        </div>
        <div className={styles.cardAmount}>
          {formatUnits(mandate.windowCap)}
          <small>{DEMO_TOKEN_SYMBOL} per 24h</small>
        </div>
        <dl className={styles.cardMeta}>
          <div>
            <dt>Max per payment</dt>
            <dd>{formatUnits(mandate.perTxCap)}</dd>
          </div>
          <div>
            <dt>Can only pay</dt>
            <dd>{short(mandate.recipient)}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>What to send them</span>
        <div className={styles.copyRow}>
          <code className={styles.code}>{brief}</code>
          <button
            type="button"
            onClick={copy}
            className={`${styles.copy} ${copied ? styles.copied : ''}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </section>
  );
}
