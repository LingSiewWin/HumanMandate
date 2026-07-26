# Contracts

Foundry project. `lib/` is not committed, so a fresh clone needs one bootstrap step.

```bash
git clone <repo> && cd <repo>/contracts
./bootstrap.sh     # installs pinned forge-std v1.16.2 + OpenZeppelin v5.0.2
forge test
```

That's it — no submodules, no `.env` required.

`AgentBookFork.t.sol` forks World Chain mainnet at a pinned block (32845385) and reads the
real AgentBook at `0xA23aB2712eA7BBa896930544C7d6636a96b944dA`. It uses a public Alchemy
endpoint by default; if that rate-limits you, supply your own:

```bash
WORLD_CHAIN_RPC_URL=https://<your-world-chain-rpc> forge test
```

To run offline, skip the fork suite: `forge test --no-match-contract Fork`.

`contracts/legacy/` holds the retired Uniswap v4 allowlist hook — outside the compiled source
paths, so `forge test` ignores it. Its 47 MB dependency: `./bootstrap.sh --legacy`.
