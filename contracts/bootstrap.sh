#!/usr/bin/env bash
# Installs every Solidity dependency this repo needs. Safe to re-run.
# Deps are pinned; `lib/` is gitignored, so a fresh clone MUST run this first.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf lib

# Core deps — required by every contract and test.
forge install foundry-rs/forge-std@v1.16.2 --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git

# Uniswap v4 — only the hook/adapter tests need this (pulls v4-core + permit2 + solmate).
forge install Uniswap/v4-periphery@3245c3cb99c48fa1dc2459c3b60abc37d4294aba --no-git

echo
echo "Dependencies installed. Run: forge test"
