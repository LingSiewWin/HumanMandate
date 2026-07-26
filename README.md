# HumanMandate

**A spending authority bound to a human — not to a wallet address.**

We do **not** issue Proof of Human. We **enforce spending rules** for a unique human that World already attested ([Achieving Proof of Human](https://whitepaper.world.org/achieving-proof-of-human) Stage 3 — authentication / relying party).

Credit cards bind to a card. ERC-20 allowances bind to an address. Revoke either and the counterparty spins up a new credential.

HumanMandate binds authority to a **World AgentBook `humanId`** and enforces it in Solidity:

- The daily cap belongs to the **person**
- Revoke cuts off the **person** — a brand-new agent address still reverts
- Raising the cap or changing the recipient requires a **fresh Selfie Check** (person-bound step-up / reauthentication — World’s illicit-transfer control class; **not** Orb-grade global uniqueness). Routine spend inside the cap does not

Built at **ETHGlobal Lisbon 2026**.

## Why this is new

Projects on [agentbook.world](https://agentbook.world) use AgentKit to gate **HTTP** endpoints. None we measured use AgentBook inside a contract to guard **money**. We read the live AgentBook from Solidity and revert on-chain.

## Live on World Chain mainnet (480)

| Contract | Address |
|---|---|
| **HumanMandate** | [`0x87BEFf69860b253E6A2476c09d3784B3fa769050`](https://worldchain-mainnet.explorer.alchemy.com/address/0x87BEFf69860b253E6A2476c09d3784B3fa769050) |
| **AgentBookRegistry** | [`0x8FeDC3D31afc91fDC777De58C2872BAD10d4706e`](https://worldchain-mainnet.explorer.alchemy.com/address/0x8FeDC3D31afc91fDC777De58C2872BAD10d4706e) |
| World AgentBook (official) | `0xA23aB2712eA7BBa896930544C7d6636a96b944dA` |

### On-chain demo (NEW mandate only)

| Beat | Result | Tx |
|---|---|---|
| Authorize | ok | [`0x883ee40f…f46e`](https://worldchain-mainnet.explorer.alchemy.com/tx/0x883ee40fdef903b2a4df28d8d800107157bada357fc34e4ca1f22e3fe33bf46e) |
| Agent pulls | ok | [`0x752ed2a5…fe18`](https://worldchain-mainnet.explorer.alchemy.com/tx/0x752ed2a5bc2573d7a21b37516565d2bffbb2eb2b6cc2ff0d9a2249e91eaefe18) |
| Over cap | revert `CapExceeded` | [`0x0c77801c…cf2b`](https://worldchain-mainnet.explorer.alchemy.com/tx/0x0c77801c7b368363323790bd7b1c6d2d2c53592ad6e008c9df754f9d53dacf2b) |
| Revoke | ok | [`0xd0fb4247…cf33`](https://worldchain-mainnet.explorer.alchemy.com/tx/0xd0fb4247899ad34cd52e15d058697a57bb81c98ca58d3f99602143d63c4fcf33) |
| **New agent address, same human** | revert `NotAuthorized` | [`0x73db3175…2208`](https://worldchain-mainnet.explorer.alchemy.com/tx/0x73db31754625ace1dc5ef9b98eb1188c609831afd291be6197de601f22b22208) |
| Raise without Selfie | revert `LivenessRequired` | [`0xa0f862aa…c924`](https://worldchain-mainnet.explorer.alchemy.com/tx/0xa0f862aa698ddc389499beaa58aef53df1543eb2032da219d6f95569634ec924) |
| Raise with Selfie attestation | ok | [`0x529cb177…d57c`](https://worldchain-mainnet.explorer.alchemy.com/tx/0x529cb1778452379399e48352e90b3a270c28f42ac229672bc2e278eb339ad57c) |

Revert selectors recovered with `cast run` / `cast sig` — not guessed.

### World App (phone E2E)

World wallet `0xE77eA7bE…295528` → NEW mandate `0x87BE…9050`:

| Step | Result | Tx |
|---|---|---|
| Authorize (MiniKit) | cap 2 | [`0x61b3cf4f…365f`](https://worldchain-mainnet.explorer.alchemy.com/tx/0x61b3cf4ff592ace254298aa743755bc3feaeac5abd5a4760321d5189909b365f) |
| **Selfie → raiseLimits** | cap 20 | [`0xb15c6476…a6f6`](https://worldchain-mainnet.explorer.alchemy.com/tx/0xb15c647653c10845bd3afdfdebd955e475686fc1d379e82c192890587e7fa6f6) |

`forge test` → **49/49**, including **4 fork tests** against live World Chain AgentBook.

## Honest limits

1. AgentBook `register()` can overwrite bindings — personhood raises the cost of a clean identity; it does **not** make respawn impossible.
2. World App revokes ERC-20 approvals after each transaction — this mandate’s **payer cannot be the in-app World wallet**; use a normal EOA / smart account. Standing debit from World App is not possible today.
3. AgentBook `humanId` and a mini-app nullifier are unlinkable across `app_id`s — binding them is an explicit app step.

## Partner tracks

- World **AgentKit** — on-chain human-bound enforcement
- World **Selfie Check** — step-up / privilege escalation
- World **Identity Check** — attribute-gated eligibility (feedback in submission materials)

## Setup

```sh
cd contracts
forge test
```

Secrets live in local `.env` files only — never committed.

## AI usage disclosure

Built with Claude Code / Cursor as pair programmers for scaffolding, tests, and doc-driven integration. Architecture, product calls, and verification of every on-chain claim were made by the team. Every transaction hash in this README was executed for real.
