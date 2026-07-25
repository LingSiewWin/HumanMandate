# First Stock

Buy your first $5 of US stocks with the USDC you already have — inside World App.

A ZK Identity Check (proves 18+, non-US nationality; no document leaves the phone) gates a Uniswap v4 allowlist hook: verified wallets swap, unverified wallets **revert on-chain**. Compliance isn't a pop-up — it's enforced by the pool itself.

## Modules

| Dir | What | Stack |
|---|---|---|
| `contracts/` | v4 allowlist hook + agent spend-cap | Solidity, Foundry |
| `miniapp/` | World App mini-app + proof verification | MiniKit, TypeScript |
| `scripts/` | Real mainnet swaps | Uniswap Trading API |
| `agent/` | $2/day DCA agent (capped, one-tap revoke) | TypeScript |

## Setup

```sh
bun install          # per package
cp .env.example .env # fill locally — .env is never committed
forge test           # in contracts/
```

Built at ETHGlobal Lisbon 2026.
