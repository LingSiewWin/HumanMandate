/**
 * MandateSwapper constants, ABI fragments and the verified mainnet run.
 *
 * The swapper sits between the mandate and the payee: the mandate pays out to the
 * swapper, the swapper converts and forwards to the payee the payer named. Every
 * hash below is a real World Chain mainnet transaction from a single end-to-end run.
 */

export const SWAPPER_ADDRESS =
  '0x4054fC0708799B906276984575cDfaBbe1Df45e9' as `0x${string}`;

/**
 * The mandate whose route the panel displays: `keccak256("humanmandate-swap-card")`,
 * verified on chain as the card the end-to-end run below was executed against.
 *
 * A payer holds many mandates and only some of them convert on the way out, so the
 * route panel is scoped to a specific card rather than to the wallet. Reading the
 * app's general-purpose default here would correctly return an unset route and the
 * panel would show an empty state while a configured route sits on chain.
 */
export const SWAP_MANDATE_ID =
  '0xd432b2c0ac5106d3f6b6b4399ae285ea40509a5eb3ba7b8bc2dc3844007671eb' as `0x${string}`;

/** Token the mandate spends — the amount the daily cap is measured in. */
export const TOKEN_IN = {
  address: '0x4200000000000000000000000000000000000006' as `0x${string}`,
  symbol: 'WETH',
  decimals: 18,
} as const;

/** Token the payee is paid in, after conversion. */
export const TOKEN_OUT = {
  address: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as `0x${string}`,
  symbol: 'USDC.e',
  decimals: 6,
} as const;

export const ROUTE_PAYEE =
  '0x1eBd8D2862c66b335D3CDB2f3479ee6B42DE69aD' as `0x${string}`;

/** Route source for the run below. Routing type CLASSIC, 1054 bytes of calldata. */
export const TRADING_API = 'https://trade-api.gateway.uniswap.org/v1';

export const swapperAbi = [
  {
    type: 'function',
    name: 'routes',
    stateMutability: 'view',
    inputs: [
      { name: 'payer', type: 'address' },
      { name: 'mandateId', type: 'bytes32' },
    ],
    outputs: [
      { name: 'humanRef', type: 'bytes32' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'payee', type: 'address' },
      { name: 'set', type: 'bool' },
    ],
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
    name: 'router',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'Settled',
    inputs: [
      { name: 'payer', type: 'address', indexed: true },
      { name: 'mandateId', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: false },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'payee', type: 'address', indexed: false },
    ],
  },
] as const;

export type SwapProof = {
  label: string;
  /** True where the contract declined the call by design, not by accident. */
  refused: boolean;
  tx: `0x${string}`;
  /** Custom-error selector and signature, for the call that was refused. */
  selector?: string;
};

/**
 * The live run on World Chain mainnet, in order. Step 4 is the load-bearing one:
 * without a refusal to point at, a floor is only a claim.
 */
export const swapProofs: readonly SwapProof[] = [
  {
    label: 'Payer opened the mandate, paying out to the swapper',
    refused: false,
    tx: '0xf8c784f4f8b386468a60211103cf97b68c8efda28af3916db2979f410b1f3d6e',
  },
  {
    label: 'Payer declared the route — what it converts into, who receives it',
    refused: false,
    tx: '0x64d5c3c2ec7132ede57e4cf19ce4f37a9f1db0a175cba49475b9fbdf28fc914f',
  },
  {
    label: 'The agent spent 0.0005 WETH under the cap',
    refused: false,
    tx: '0x92cf187cd3be1d42e7300c7ae209d340f581320d3bf19ef6f39567d950118473',
  },
  {
    label: 'Settle demanding a floor the route could not pay — refused',
    refused: true,
    tx: '0x354bd1260bb7a456215a7b4ffe0b515cef16e533c0ebd17de0bdf9afaec4ea1f',
    selector: '0x76baadda SlippageTooHigh(received 939042, minOut 1878084)',
  },
  {
    label: 'Settle with an honest floor — payee received 0.939127 USDC.e',
    refused: false,
    tx: '0x33ad7da0b934af549ebaebddaeef7e8efa80371f70280504eb629fb6bbef09a5',
  },
] as const;

/** Quoted output in base units; the payee actually received 939127. */
export const QUOTED_OUT = '939042';
export const RECEIVED_OUT = '939127';

export type RouteView = {
  /** Chain- and contract-scoped reference to the authorised person. */
  humanRef: string;
  tokenIn: string;
  tokenOut: string;
  payee: string;
  set: boolean;
};
