// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Demo stand-in for an issuer-permissioned asset on testnet.
contract DemoAsset is ERC20 {
    constructor() ERC20("Permissioned Asset (demo)", "pASSET") {
        _mint(msg.sender, 10_000_000e18);
    }
}

/// @notice Demo stablecoin for pool liquidity (18 decimals to keep demo math simple).
contract DemoUSD is ERC20 {
    constructor() ERC20("Demo USD", "dUSD") {
        _mint(msg.sender, 10_000_000e18);
    }
}
