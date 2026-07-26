/** HumanMandate mainnet constants + ABI fragments. Demo evidence from HANDOFF (real txs). */

export const MANDATE_ADDRESS = (process.env.NEXT_PUBLIC_MANDATE_ADDRESS ??
  '0x87BEFf69860b253E6A2476c09d3784B3fa769050') as `0x${string}`;

/** Pre-step-up mandate used for the five-beat authorize/pull/cap/revoke/NotAuthorized demo. */
export const OLD_MANDATE_ADDRESS =
  '0xE78f6c235FD1686547DBea41F742D649607316B1' as const;

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
  '0x8FeDC3D31afc91fDC777De58C2872BAD10d4706e') as `0x${string}`;

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
    inputs: [{ name: 'payer', type: 'address' }],
    outputs: [
      { name: 'humanId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'dailyCap', type: 'uint128' },
      { name: 'spentToday', type: 'uint128' },
      { name: 'day', type: 'uint64' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'authorize',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'humanId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'dailyCap', type: 'uint128' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'raiseLimits',
    stateMutability: 'nonpayable',
    inputs: [
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
    inputs: [{ name: 'newCap', type: 'uint128' }],
    outputs: [],
  },
] as const;

export type DemoBeat = {
  label: string;
  ok: boolean;
  tx: `0x${string}`;
};

/**
 * Five-beat money shot on OLD mandate (no step-up).
 * cast receipt → to = 0xE78f6c235FD1686547DBea41F742D649607316B1 for every hash.
 */
export const oldFiveBeat: readonly DemoBeat[] = [
  {
    label: 'Authorize human, cap 2',
    ok: true,
    tx: '0x8929b18e08e9529c11233616f8c99cca8cd6c03a72056ad661eed5c64525df24',
  },
  {
    label: 'Agent A pulls 2',
    ok: true,
    tx: '0x2d012b5bdabd33fdd924ec93ecce2777c0f1277ffc97c2095fbb063dd0f83952',
  },
  {
    label: 'Over cap → CapExceeded',
    ok: false,
    tx: '0x225d83528c06ed1de2f6aa515d288cd433248662bdecec9a1d62d808f057d705',
  },
  {
    label: 'Revoke',
    ok: true,
    tx: '0xd035658f9a1253de2fca070caf1f96aa53a6da0b2f7fafca0006c911a5504d31',
  },
  {
    label: 'Agent B new address → NotAuthorized',
    ok: false,
    tx: '0x18d30df92a1c78b88e6cb0e209aa15420cff2c9e817d5962582a1df936999c4a',
  },
] as const;

/**
 * Step-up beats on NEW mandate (with livenessAttestor).
 * cast receipt → to = 0x87BEFf69860b253E6A2476c09d3784B3fa769050 for every hash.
 */
export const newStepUp: readonly DemoBeat[] = [
  {
    label: 'Raise cap without Selfie → LivenessRequired',
    ok: false,
    tx: '0xa0f862aa698ddc389499beaa58aef53df1543eb2032da219d6f95569634ec924',
  },
  {
    label: 'Raise cap with Selfie attestation',
    ok: true,
    tx: '0x529cb1778452379399e48352e90b3a270c28f42ac229672bc2e278eb339ad57c',
  },
] as const;


/**
 * Five-beat money shot on NEW mandate (with livenessAttestor).
 * Includes prior authorize + pull PASS txs plus CapExceeded / revoke / NotAuthorized (2026-07-26).
 * cast receipt → to = 0x87BEFf69860b253E6A2476c09d3784B3fa769050 for every hash.
 */
export const newFiveBeat: readonly DemoBeat[] = [
  {
    label: 'Authorize human',
    ok: true,
    tx: '0x883ee40fdef903b2a4df28d8d800107157bada357fc34e4ca1f22e3fe33bf46e',
  },
  {
    label: 'Agent A pulls 20 (post step-up)',
    ok: true,
    tx: '0x752ed2a5bc2573d7a21b37516565d2bffbb2eb2b6cc2ff0d9a2249e91eaefe18',
  },
  {
    label: 'Over cap → CapExceeded',
    ok: false,
    tx: '0x0c77801c7b368363323790bd7b1c6d2d2c53592ad6e008c9df754f9d53dacf2b',
  },
  {
    label: 'Revoke',
    ok: true,
    tx: '0xd0fb4247899ad34cd52e15d058697a57bb81c98ca58d3f99602143d63c4fcf33',
  },
  {
    label: 'Agent B new address → NotAuthorized',
    ok: false,
    tx: '0x73db31754625ace1dc5ef9b98eb1188c609831afd291be6197de601f22b22208',
  },
] as const;

export type MandateView = {
  humanId: string;
  token: string;
  recipient: string;
  dailyCap: string;
  spentToday: string;
  day: string;
  active: boolean;
  empty: boolean;
};
