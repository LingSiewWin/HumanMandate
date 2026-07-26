# Contracts

Foundry project. `lib/` is not committed, so a fresh clone needs one bootstrap step.

```bash
git clone <repo> && cd <repo>/contracts
./bootstrap.sh     # installs pinned forge-std, OpenZeppelin v5.0.2, Uniswap v4-periphery
forge test
```

That's it — no submodules, no `.env` required.

`AgentBookFork.t.sol` forks World Chain mainnet at a pinned block (32845385) using a public
Alchemy endpoint. If that endpoint rate-limits you, supply your own:

```bash
WORLD_CHAIN_RPC_URL=https://<your-world-chain-rpc> forge test
```

To skip the fork tests entirely (no network): `forge test --no-match-contract Fork`.
