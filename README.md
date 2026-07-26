# HumanMandate

**A spending authority bound to a human — not to a wallet address.**

We do **not** issue Proof of Human. We **enforce spending rules** for a unique human that World already attested ([Achieving Proof of Human](https://whitepaper.world.org/achieving-proof-of-human) Stage 3 — authentication / relying party).

Credit cards bind to a card. ERC-20 allowances bind to an address. If you revoke either, the counterparty spins up a new credential and comes back.

HumanMandate binds the authority to a **World AgentBook `humanId`** (the anonymous human identifier from World ID), and **enforces it in Solidity**:

- The daily cap belongs to the **person**
- Revoke cuts off the **person** — a brand-new agent address still reverts
- Raising the cap or changing the recipient requires a **fresh Selfie Check** as person-bound step-up / reauthentication (World’s illicit-transfer control class; **not** a claim of Orb-grade global uniqueness). Routine spend inside the cap does not — like Face ID: it unlocks dangerous actions, not every tap

Built at **ETHGlobal Lisbon 2026**.

## Why this is new

Projects listed on [agentbook.world](https://agentbook.world) use AgentKit to gate **HTTP** endpoints. None of them (that we measured) use AgentBook inside a contract to guard **money**. That HTTP-only pattern is exactly what the AgentKit track discourages. We read the live AgentBook from Solidity and revert on-chain.

## Live on World Chain mainnet (chain 480)

| Contract | Address |
|---|---|
| **HumanMandate** (with step-up) | [`0x87BEFf69860b253E6A2476c09d3784B3fa769050`](https://worldchain-mainnet.explorer.alchemy.com/address/0x87BEFf69860b253E6A2476c09d3784B3fa769050) |
| **AgentBookRegistry** | [`0x8FeDC3D31afc91fDC777De58C2872BAD10d4706e`](https://worldchain-mainnet.explorer.alchemy.com/address/0x8FeDC3D31afc91fDC777De58C2872BAD10d4706e) |
| World AgentBook (official) | `0xA23aB2712eA7BBa896930544C7d6636a96b944dA` |

Also deployed on Base (same AgentBook bytecode family).

### Demo evidence (real txs)

| Beat | Result | Tx |
|---|---|---|
| Authorize human, cap 2 | ok | `0x8929b18e…df24` |
| Agent A pulls 2 | ok | `0x2d012b5b…3952` |
| Agent A over cap | revert `CapExceeded` | `0x225d8352…d705` |
| Revoke | ok | `0xd035658f…4d31` |
| **Agent B new address, same human** | revert `NotAuthorized` | `0x18d30df9…c4a` |
| Raise cap without Selfie | revert `LivenessRequired` | `0xa0f862aa…c924` |
| Raise cap with Selfie attestation | ok | `0x529cb177…d57c` |

Revert selectors were recovered with `cast run` and matched with `cast sig` — not guessed.

`forge test` → **49/49**, including **4 fork tests** against the live World Chain AgentBook.

## Repo layout

| Path | What |
|---|---|
| `contracts/` | `HumanMandate`, `AgentBookRegistry`, Foundry tests + deploy scripts |
| `miniapp/` | World mini-app shell; `/api/step-up` verifies Selfie Check and **signs** EIP-712 (never broadcasts) |
| `scripts/` | Trading / ops helpers |

## Honest limits (we say these out loud)

1. AgentBook `register()` can overwrite bindings — personhood raises the cost of a clean identity; it does **not** “make respawn impossible.” World’s own whitepaper notes complete prevention of credential delegation is likely impossible; we match that honesty.
2. World App revokes ERC-20 approvals after each transaction — this mandate’s **payer cannot be the in-app World wallet**; use a normal EOA / smart account. We filed this as World developer feedback.
3. AgentBook `humanId` and a mini-app’s own nullifier are unlinkable across `app_id`s — binding them is an explicit app step.

## Partner tracks

- World **AgentKit** — on-chain human-bound enforcement
- World **Selfie Check** — step-up / privilege escalation
- World **Identity Check** — attribute-gated eligibility (feedback docs in submission materials)
- Optional second door: earlier **First Stock** permissioned-pool work in this repo (Identity-gated Uniswap v4 allowlist + on-chain revert)

## Setup

```sh
cd contracts
forge test
```

Secrets live in local `.env` files only — never committed.

## AI usage disclosure

Built with Claude Code / Cursor as pair programmers for scaffolding, tests, and doc-driven integration. Architecture, product calls, and verification of every on-chain claim were made by the team. Every transaction hash in this README was executed for real.
