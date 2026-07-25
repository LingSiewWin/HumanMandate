// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseAllowlistChecker} from "v4-periphery/src/hooks/permissionedPools/BaseAllowListChecker.sol";
import {
    PermissionFlag,
    PermissionFlags
} from "v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title WorldAllowlistChecker
/// @notice IAllowlistChecker implementation fed by World ID Identity Check proofs.
///         Owner = backend signer that verifies ZK proofs off-chain (World Developer Portal API),
///         then registers the proven wallet here. One World ID nullifier maps to at most one
///         wallet, so one human can never allowlist a fleet of addresses.
contract WorldAllowlistChecker is BaseAllowlistChecker, Ownable2Step {
    error ZeroAddress();
    error NullifierAlreadyUsed(uint256 nullifierHash);

    event AccountVerified(address indexed account, uint256 indexed nullifierHash);
    event AccountRevoked(address indexed account);

    mapping(address account => bool) public verified;
    mapping(uint256 nullifierHash => bool) public usedNullifiers;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function verify(address account, uint256 nullifierHash) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        if (usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);
        usedNullifiers[nullifierHash] = true;
        verified[account] = true;
        emit AccountVerified(account, nullifierHash);
    }

    function revoke(address account) external onlyOwner {
        verified[account] = false;
        emit AccountRevoked(account);
    }

    /// @inheritdoc BaseAllowlistChecker
    function checkAllowlist(address account, address) public view override returns (PermissionFlag) {
        return verified[account] ? PermissionFlags.ALL_ALLOWED : PermissionFlags.NONE;
    }
}
