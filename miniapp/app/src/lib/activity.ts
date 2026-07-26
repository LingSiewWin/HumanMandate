/**
 * On-chain activity for a payer's mandate.
 *
 * Events are read from the Blockscout explorer rather than eth_getLogs: the public
 * World Chain RPC caps getLogs at a 100-block range, so a feed covering the whole
 * life of the contract would need ~50 round trips per load. The explorer serves the
 * same logs in one request.
 *
 * Each topic below was cross-checked against a real log emitted by the deployed
 * contract, not just derived from the source tree — the two disagreed once already,
 * when the app was still pointed at the pre-multi-mandate deployment.
 */

import { decodeAbiParameters, parseAbiParameters } from 'viem';
import { MANDATE_ADDRESS } from './mandate';

const EXPLORER_API = 'https://worldchain-mainnet.explorer.alchemy.com/api';

/** Block the live mandate was deployed in — nothing before this can concern it. */
const DEPLOY_BLOCK = 32849900;

export const TOPIC = {
  authorized: '0x5771ecc595a1c8520a29d007ac13e1eafdff15fd042f5d33ba77b73a76e821fd',
  pulled: '0xfaed5cb0501162bf8b53e65808e8e9bf76b5143d608fef8d32904ddf0de329c5',
  revoked: '0x6e70be4be1a4aebd688b5523bd8b6278acac3963d71ebf2bd5ea50757047664b',
  limitsRaised: '0xd90116cadd45371e280b1cf1cd213d7d7e08b5c2ca12eeb53f2f395961f02197',
} as const;

export type ActivityKind = 'authorized' | 'pulled' | 'revoked' | 'raised';

export type ActivityItem = {
  kind: ActivityKind;
  /** Plain language, written for someone who does not know what a nonce is. */
  title: string;
  detail: string;
  /** Token amount in base units, when the event moves money. */
  amount?: string;
  /** The mandate this event belongs to. One payer runs several, each with its own token. */
  mandateId?: string;
  /** Only the Authorized event names the token, so it is filled in per mandate below. */
  token?: string;
  agent?: string;
  recipient?: string;
  blockNumber: number;
  txHash: string;
};

type RawLog = {
  topics: (string | null)[];
  data: `0x${string}`;
  blockNumber: string;
  transactionHash: string;
};

/** Whole-token rendering for prose, e.g. "3" rather than "3000000000000000000". */
function formatWhole(raw: bigint, decimals = 18): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac.slice(0, 2)}` : whole.toString();
}

function topicAddress(topic: string | null | undefined): string {
  if (!topic) return '';
  return `0x${topic.slice(-40)}`;
}

async function fetchLogs(topic0: string, payer: string): Promise<RawLog[]> {
  const url =
    `${EXPLORER_API}?module=logs&action=getLogs` +
    `&address=${MANDATE_ADDRESS}` +
    `&fromBlock=${DEPLOY_BLOCK}&toBlock=latest` +
    `&topic0=${topic0}` +
    `&topic1=0x000000000000000000000000${payer.slice(2).toLowerCase()}` +
    `&topic0_1_opr=and`;

  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const body = (await res.json()) as { status: string; result: RawLog[] | string };
  // Blockscout answers "no matches" with status "0" and a string result. That is an
  // empty feed, not a failure.
  if (!Array.isArray(body.result)) return [];
  return body.result;
}

function decodePulled(log: RawLog): ActivityItem {
  // Pulled(payer indexed, mandateId indexed, agent, amount, recipient)
  const [agent, amount, recipient] = decodeAbiParameters(
    parseAbiParameters('address, uint256, address'),
    log.data,
  );
  return {
    kind: 'pulled',
    title: 'Your card was charged',
    detail: 'An agent of the authorised person spent inside the limit.',
    amount: amount.toString(),
    mandateId: log.topics[2] ?? undefined,
    agent,
    recipient,
    blockNumber: Number(log.blockNumber),
    txHash: log.transactionHash,
  };
}

function decodeAuthorized(log: RawLog): ActivityItem {
  // Authorized(payer indexed, mandateId indexed, humanRef, token, windowCap, perTxCap, recipient)
  const [, token, cap, perTx, recipient] = decodeAbiParameters(
    parseAbiParameters('bytes32, address, uint128, uint128, address'),
    log.data,
  );
  const perTxNote =
    perTx < cap
      ? `No single payment may exceed ${formatWhole(perTx)} of that.`
      : 'A single payment may use the whole allowance.';
  return {
    kind: 'authorized',
    title: 'Card created',
    detail: `Locked to one payee. ${perTxNote}`,
    amount: cap.toString(),
    mandateId: log.topics[2] ?? undefined,
    token,
    recipient,
    blockNumber: Number(log.blockNumber),
    txHash: log.transactionHash,
  };
}

function decodeRaised(log: RawLog): ActivityItem {
  // LimitsRaised(payer indexed, mandateId indexed, windowCap, recipient)
  const [cap, recipient] = decodeAbiParameters(
    parseAbiParameters('uint128, address'),
    log.data,
  );
  return {
    kind: 'raised',
    title: 'Limit raised',
    detail: 'You passed a fresh Selfie Check to widen this card.',
    amount: cap.toString(),
    mandateId: log.topics[2] ?? undefined,
    recipient,
    blockNumber: Number(log.blockNumber),
    txHash: log.transactionHash,
  };
}

function decodeRevoked(log: RawLog): ActivityItem {
  return {
    kind: 'revoked',
    title: 'Card stopped',
    detail: 'Every agent that person will ever operate lost access here.',
    mandateId: log.topics[2] ?? undefined,
    blockNumber: Number(log.blockNumber),
    txHash: log.transactionHash,
  };
}

/**
 * The payer's full mandate history, newest first.
 *
 * Only successful transactions appear: a refused charge reverts, and a reverted
 * transaction emits no log. That is the honest shape of the feed — it shows what the
 * card *did*, and the refusals are visible on the contract, not here.
 */
export async function readActivity(payer: string): Promise<ActivityItem[]> {
  const [authorized, pulled, revoked, raised] = await Promise.all([
    fetchLogs(TOPIC.authorized, payer),
    fetchLogs(TOPIC.pulled, payer),
    fetchLogs(TOPIC.revoked, payer),
    fetchLogs(TOPIC.limitsRaised, payer),
  ]);

  const items: ActivityItem[] = [
    ...authorized.map(decodeAuthorized),
    ...pulled.map(decodePulled),
    ...revoked.map(decodeRevoked),
    ...raised.map(decodeRaised),
  ];

  // Only Authorized names the token, but a payer's mandates do not all spend the same
  // one. Without this the feed would label a WETH charge with the other card's symbol.
  const tokenByMandate = new Map<string, string>();
  for (const item of items) {
    if (item.kind === 'authorized' && item.mandateId && item.token) {
      tokenByMandate.set(item.mandateId, item.token);
    }
  }
  for (const item of items) {
    if (!item.token && item.mandateId) {
      item.token = tokenByMandate.get(item.mandateId);
    }
  }

  return items.sort((a, b) => b.blockNumber - a.blockNumber);
}

export { topicAddress };
