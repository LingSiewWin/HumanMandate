#!/usr/bin/env bash
# Installs every Solidity dependency this repo needs. Safe to re-run.
# Deps are pinned; `lib/` is gitignored, so a fresh clone MUST run this first.
#
#   ./bootstrap.sh            # what `forge test` needs (~10s, 11 MB)
#   ./bootstrap.sh --legacy   # also pulls Uniswap v4-periphery for contracts/legacy/ (~47 MB)
set -euo pipefail
cd "$(dirname "$0")"

rm -rf lib

# Required by every contract under src/, test/ and script/.
forge install foundry-rs/forge-std@v1.16.2 --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git

# Only contracts/legacy/ (the retired Uniswap v4 allowlist hook) imports v4. It is outside
# the compiled source paths, so `forge test` does not need this 47 MB clone.
if [ "${1:-}" = "--legacy" ]; then
    forge install Uniswap/v4-periphery@3245c3cb99c48fa1dc2459c3b60abc37d4294aba --no-git
fi

echo
echo "Dependencies installed. Run: forge test"
