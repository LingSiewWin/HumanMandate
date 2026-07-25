// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Maps an address to the anonymous human behind it. Returns 0 when unknown.
///         Two implementations exist: World's AgentBook (agents registered by an Orb-verified
///         human) and our own EligibilityChecker (wallets bound to a World ID nullifier).
///         Same shape, so a mandate can be enforced against either source.
interface IHumanRegistry {
    function humanOf(address account) external view returns (uint256);
}
