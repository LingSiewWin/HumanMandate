// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseAllowlistChecker} from "v4-periphery/src/hooks/permissionedPools/BaseAllowListChecker.sol";
import {
    PermissionFlag,
    PermissionFlags
} from "v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title WorldAllowlistChecker
/// @notice IAllowlistChecker implementation fed by World ID Identity Check proofs.
///         Owner = backend signer that verifies ZK proofs off-chain (World Developer Portal API),
///         then registers the proven wallet here. A World ID nullifier is bound to at most one
///         active wallet: proving again from a new wallet migrates the credential (old wallet
///         revoked), so one human can never operate a fleet of allowlisted addresses.
contract WorldAllowlistChecker is BaseAllowlistChecker, Ownable2Step, EIP712 {
    error ZeroAddress();
    error InvalidNullifier();
    error AccountAlreadyBound(address account);
    error InvalidVoucher();
    error VoucherExpired();

    bytes32 private constant VOUCHER_TYPEHASH =
        keccak256("EligibilityVoucher(address account,uint256 nullifierHash,uint256 deadline)");

    event AccountVerified(address indexed account, uint256 indexed nullifierHash);
    event AccountRevoked(address indexed account);

    mapping(address account => bool) public verified;
    mapping(uint256 nullifierHash => address account) public nullifierAccount;
    mapping(address account => uint256 nullifierHash) public accountNullifier;

    constructor(address initialOwner) Ownable(initialOwner) EIP712("WorldAllowlistChecker", "1") {}

    function voucherDigest(address account, uint256 nullifierHash, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(VOUCHER_TYPEHASH, account, nullifierHash, deadline)));
    }

    /// @notice Permissionless registration: anyone may submit a voucher signed by the owner
    ///         (the proof verifier). The verifier signs off-chain; it never has to send a tx,
    ///         so it sits outside the user's money path.
    function verifyWithVoucher(address account, uint256 nullifierHash, uint256 deadline, bytes calldata signature)
        external
    {
        if (block.timestamp > deadline) revert VoucherExpired();
        if (ECDSA.recover(voucherDigest(account, nullifierHash, deadline), signature) != owner()) {
            revert InvalidVoucher();
        }
        _register(account, nullifierHash);
    }

    function verify(address account, uint256 nullifierHash) external onlyOwner {
        _register(account, nullifierHash);
    }

    function _register(address account, uint256 nullifierHash) internal {
        if (account == address(0)) revert ZeroAddress();
        if (nullifierHash == 0) revert InvalidNullifier();

        uint256 existingNullifier = accountNullifier[account];
        if (existingNullifier != 0 && existingNullifier != nullifierHash) {
            revert AccountAlreadyBound(account);
        }

        address previousAccount = nullifierAccount[nullifierHash];
        if (previousAccount != address(0) && previousAccount != account) {
            verified[previousAccount] = false;
            delete accountNullifier[previousAccount];
            emit AccountRevoked(previousAccount);
        }

        nullifierAccount[nullifierHash] = account;
        accountNullifier[account] = nullifierHash;
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
