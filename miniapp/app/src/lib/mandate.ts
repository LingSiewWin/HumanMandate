/** HumanMandate mainnet constants + ABI fragments. Demo evidence from HANDOFF (real txs). */

export const MANDATE_ADDRESS = (process.env.NEXT_PUBLIC_MANDATE_ADDRESS ??
  '0x7fcEc100ADc4e89b09a92e3f7931161791D06054') as `0x${string}`;

/** Superseded deployments. Kept only so old links resolve; nothing reads them. */
export const OLD_MANDATE_ADDRESSES = [
  '0xE78f6c235FD1686547DBea41F742D649607316B1',
  '0x87BEFf69860b253E6A2476c09d3784B3fa769050',
] as const;

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
  '0x9Ac36746eFbb8192b0D5BB8C0774026bff1b9aB4') as `0x${string}`;

export const AGENTBOOK_ADDRESS =
  '0xA23aB2712eA7BBa896930544C7d6636a96b944dA' as const;

export const MANDATE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_MANDATE_CHAIN_ID ?? 480);

/** DemoUSD on World Chain — Permit2 whitelist must include this for phone txs. */
export const DEMO_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS ??
  '0xA471D2C45F03518E47c7Fc71C897d244dF01859D') as `0x${string}`;

/** Test token, not real money. Shown to the user before they sign. */
export const DEMO_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_DEMO_TOKEN_SYMBOL ?? 'DemoUSD';

/**
 * humanId of the PROJECT'S OWN demo agent operator — i.e. a third party from the
 * point of view of anyone else opening the mini-app.
 *
 * Authorizing this id lets that person's registered agents pull from the signer's
 * wallet. It is therefore only ever used behind the explicitly labelled "demo agent"
 * path in components/Mandate, which discloses the id, the cap, the payee and the
 * revoke path before the user signs. Never make it the silent default.
 */
export const DEMO_AGENT_HUMAN_ID = BigInt(
  process.env.NEXT_PUBLIC_DEMO_HUMAN_ID ??
    '674286712274374622200600850590512922406691432103577922617674776808416716138',
);

/** Fixed payee of the demo mandate — the only address a demo agent can pay. */
export const DEMO_RECIPIENT = (process.env.NEXT_PUBLIC_DEMO_RECIPIENT ??
  '0x1eBd8D2862c66b335D3CDB2f3479ee6B42DE69aD') as `0x${string}`;

/** Initial daily cap when turning the card on from World App (18 decimals). */
export const DEMO_INITIAL_CAP = BigInt(process.env.NEXT_PUBLIC_DEMO_INITIAL_CAP ?? '2000000000000000000');

export const WORLDCHAIN_RPC =
  process.env.NEXT_PUBLIC_WORLDCHAIN_RPC ??
  'https://worldchain-mainnet.g.alchemy.com/public';

export const EXPLORER = 'https://worldchain-mainnet.explorer.alchemy.com';

export function explorerAddress(addr: string): string {
  return `${EXPLORER}/address/${addr}`;
}

export function explorerTx(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export const mandateAbi = [
  {
    type: 'function',
    name: 'mandates',
    stateMutability: 'view',
    inputs: [
      { name: 'payer', type: 'address' },
      { name: 'mandateId', type: 'bytes32' },
    ],
    outputs: [
      { name: 'humanRef', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'windowCap', type: 'uint128' },
      { name: 'perTxCap', type: 'uint128' },
      { name: 'spentInWindow', type: 'uint128' },
      { name: 'windowStart', type: 'uint64' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'humanRef',
    stateMutability: 'view',
    inputs: [{ name: 'humanId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'refOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'authorize',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'mandateId', type: 'bytes32' },
      { name: 'authorizedHumanRef', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'windowCap', type: 'uint128' },
      { name: 'perTxCap', type: 'uint128' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'mandateId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'stepUpDigest',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'mandateId', type: 'bytes32' },
      { name: 'newCap', type: 'uint128' },
      { name: 'newRecipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'raiseLimits',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'mandateId', type: 'bytes32' },
      { name: 'newCap', type: 'uint128' },
      { name: 'newRecipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'livenessProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'lowerCap',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'mandateId', type: 'bytes32' },
      { name: 'newCap', type: 'uint128' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pull',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'payer', type: 'address' },
      { name: 'mandateId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export type DemoBeat = {
  label: string;
  ok: boolean;
  tx: `0x${string}`;
  /** Custom-error selector recovered with `cast run`, for the beats that revert. */
  selector?: string;
};

/**
 * The full demo, re-run against the current deployment on 2026-07-26.
 *
 * Every hash below is `to = 0x7fcEc100ADc4e89b09a92e3f7931161791D06054` — one contract,
 * so nothing here needs a caveat about which version it came from. Each revert selector
 * was recovered with `cast run` and matched against `cast sig`, not assumed.
 *
 * The load-bearing pair is beats 2 and 3: an address the mandate never named spends
 * successfully, and an address with no human behind it is refused. Either one alone
 * proves nothing.
 */
export const demoBeats: readonly DemoBeat[] = [
  {
    label: 'Create the card — cap 3/day, max 2 per payment',
    ok: true,
    tx: '0x5b117a04db815f41d2a9870f49ca4cf098f872e280e7fb6826f1aee1e547ec2a',
  },
  {
    label: 'An address the card never named spends anyway',
    ok: true,
    tx: '0xb7fa49a1a4a08774ea6a470e50c2aa23a7645906d4b630e38fd9e6764bc44620',
  },
  {
    label: 'A wallet with no human behind it is refused',
    ok: false,
    tx: '0x9ebb088a3a91b11d110c8c396083ff1cdb34863f6c4bffa926834e8e9ae81f0e',
    selector: '0x203ac8ca NotHumanBacked',
  },
  {
    label: 'One payment larger than the per-payment limit',
    ok: false,
    tx: '0x33e79b96d1035ed533e097566456af6a6a38846f032e8d966e1cb6d4288cb650',
    selector: '0xcb0bcbd5 PerTxCapExceeded',
  },
  {
    label: 'A second agent of the same person spends the same budget',
    ok: true,
    tx: '0x7da5b4ba0d69c3d819f3ca43c5e0b4e395c02aa9fded20a6cb5650065436767e',
  },
  {
    label: 'One wei past the daily cap',
    ok: false,
    tx: '0xe91dcc5f00fafbed9154e6952689f6a155604511992187608b95c1aa4d54f2be',
    selector: '0x2e8b3b3b CapExceeded',
  },
  {
    label: 'Raise the limit with no Selfie Check',
    ok: false,
    tx: '0x61f5ccf45deaa8f40712b769fd44f50b8a614dc38f05b51253dc00045911cdd5',
    selector: '0x6aaa9349 LivenessRequired',
  },
  {
    label: 'Raise the limit with a fresh liveness attestation',
    ok: true,
    tx: '0xb1e646009690254f768a3706204639e47b0bfda01261e9ab2d268941bc24e603',
  },
  {
    label: 'Replay that same attestation',
    ok: false,
    tx: '0x1fa5fa9072c5a58e9f0e147f5e8a1fe326b1c7cb5287ed57bc4044ebff8c11dc',
    selector: '0x6c866211 LivenessAlreadyUsed',
  },
  {
    label: 'Stop the card',
    ok: true,
    tx: '0xd0eed6c84ad89c3b5b55c23c6b411fd629c3877105aa483e470cbc8161a6a972',
  },
  {
    label: 'The revoked person returns on a fresh address',
    ok: false,
    tx: '0x23db1c10f5108d9d9ef930da742dd9fee9246d4293591ebe15775d51db115dab',
    selector: '0xa4e1a97e NotAuthorized',
  },
] as const;

export type MandateView = {
  /** Chain- and contract-scoped reference to the authorised person, not the raw nullifier. */
  humanRef: string;
  token: string;
  recipient: string;
  windowCap: string;
  perTxCap: string;
  spentInWindow: string;
  /** Unix seconds the current 24h window began, i.e. the first spend of that window. */
  windowStart: string;
  active: boolean;
  empty: boolean;
};

/**
 * The mandate id this mini-app manages. One payer can hold many mandates on the
 * contract; the app surfaces a single named card to keep the flow legible.
 */
export const DEFAULT_MANDATE_ID =
  '0x23a44d31bb47e84cf73771c3ebb26c3c14c6d772af04afa22a49c3df84965824' as `0x${string}`;
