/**
 * Pure helpers behind the Spending panel: token resolution, base-unit formatting, bar
 * geometry and window arithmetic. Kept out of the component so they can be exercised
 * directly against a real `/api/mandate` response.
 */

import type { CSSProperties } from 'react';
import { DEMO_TOKEN_ADDRESS, DEMO_TOKEN_SYMBOL } from '@/lib/mandate';
import { TOKEN_IN, TOKEN_OUT } from '@/lib/swapper';

/** HumanMandate.WINDOW — a rolling day, not a calendar one. */
export const WINDOW_SECONDS = 86400;

/** The tsconfig targets ES2017, where `0n` is a syntax error. */
export const ZERO = BigInt(0);

export type TokenInfo = { symbol: string; decimals: number };

/**
 * A payer's cards do not all spend the same token, so the symbol and the decimals are
 * resolved from the address the mandate actually holds. An unrecognised token gets no
 * symbol — a wrong ticker beside a real number is worse than none. Its scale is assumed
 * to be 18, the ERC-20 default; that is the only guess in this panel.
 */
export function tokenInfo(token?: string): TokenInfo {
  const at = (token ?? '').toLowerCase();
  if (at === TOKEN_IN.address.toLowerCase()) {
    return { symbol: TOKEN_IN.symbol, decimals: TOKEN_IN.decimals };
  }
  if (at === TOKEN_OUT.address.toLowerCase()) {
    return { symbol: TOKEN_OUT.symbol, decimals: TOKEN_OUT.decimals };
  }
  if (at === DEMO_TOKEN_ADDRESS.toLowerCase()) {
    return { symbol: DEMO_TOKEN_SYMBOL, decimals: 18 };
  }
  return { symbol: '', decimals: 18 };
}

/**
 * Base units to a readable figure. Truncating to two decimals turns a real 0.0005 WETH
 * charge into "0.00", which reads as though nothing was spent, so the fraction is kept
 * until it carries two significant digits.
 */
export function formatAmount(raw: bigint, decimals: number): string {
  const negative = raw < ZERO;
  const digits = (negative ? -raw : raw).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, '');
  let shown = whole;
  if (frac) {
    const leadingZeros = frac.length - frac.replace(/^0+/, '').length;
    shown = `${whole}.${frac.slice(0, leadingZeros + 2)}`;
  }
  return negative ? `-${shown}` : shown;
}

export function toBigInt(value: string | undefined): bigint {
  if (!value) return ZERO;
  try {
    return BigInt(value);
  } catch {
    return ZERO;
  }
}

/** Share of `whole` taken by `part`, as a percentage clamped to the bar's range. */
export function share(part: bigint, whole: bigint): number {
  if (whole <= ZERO) return 0;
  const percent = Number((part * BigInt(10000)) / whole) / 100;
  return Math.max(0, Math.min(100, percent));
}

export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'now';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'under a minute';
}

export function formatAgo(seconds: number): string {
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function short(addr?: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Bars are driven by custom properties so the target width lives in CSS and the
 * keyframes can animate to it. Typing them explicitly keeps the inline style cast-free.
 */
export type BarVars = CSSProperties & {
  '--hm-bar-w': string;
  '--hm-bar-delay': string;
};

export function barVars(percent: number, delayMs: number): BarVars {
  // A real but tiny charge still deserves a visible mark; zero stays zero.
  const width = percent > 0 ? Math.max(percent, 1.2) : 0;
  return { '--hm-bar-w': `${width}%`, '--hm-bar-delay': `${delayMs}ms` };
}
