// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {WorldAllowlistChecker} from "../src/WorldAllowlistChecker.sol";
import {IAllowlistChecker} from "v4-periphery/src/hooks/permissionedPools/interfaces/IAllowlistChecker.sol";
import {PermissionFlags} from "v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WorldAllowlistCheckerTest is Test {
    WorldAllowlistChecker checker;

    address backend = makeAddr("backend");
    address maria = makeAddr("maria");
    address stranger = makeAddr("stranger");
    address token = makeAddr("permissionedToken");

    uint256 constant NULLIFIER_MARIA = uint256(keccak256("maria-world-id"));

    event AccountVerified(address indexed account, uint256 indexed nullifierHash);
    event AccountRevoked(address indexed account);

    function setUp() public {
        checker = new WorldAllowlistChecker(backend);
    }

    function test_unverified_account_has_no_permissions() public view {
        assertTrue(checker.checkAllowlist(stranger, token) == PermissionFlags.NONE);
    }

    function test_verify_grants_all_permissions() public {
        vm.prank(backend);
        vm.expectEmit(true, true, false, false);
        emit AccountVerified(maria, NULLIFIER_MARIA);
        checker.verify(maria, NULLIFIER_MARIA);

        assertTrue(checker.checkAllowlist(maria, token) == PermissionFlags.ALL_ALLOWED);
    }

    function test_verify_reverts_for_non_owner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        checker.verify(maria, NULLIFIER_MARIA);
    }

    function test_verify_reverts_on_zero_address() public {
        vm.prank(backend);
        vm.expectRevert(WorldAllowlistChecker.ZeroAddress.selector);
        checker.verify(address(0), NULLIFIER_MARIA);
    }

    function test_revoke_removes_permissions() public {
        vm.startPrank(backend);
        checker.verify(maria, NULLIFIER_MARIA);
        vm.expectEmit(true, false, false, false);
        emit AccountRevoked(maria);
        checker.revoke(maria);
        vm.stopPrank();

        assertTrue(checker.checkAllowlist(maria, token) == PermissionFlags.NONE);
    }

    function test_revoke_reverts_for_non_owner() public {
        vm.prank(backend);
        checker.verify(maria, NULLIFIER_MARIA);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        checker.revoke(maria);
    }

    function test_supports_allowlist_checker_interface() public view {
        assertTrue(checker.supportsInterface(type(IAllowlistChecker).interfaceId));
    }

    function test_same_human_new_wallet_migrates_old_wallet_revoked() public {
        address mariaNewPhone = makeAddr("maria-new-phone");

        vm.startPrank(backend);
        checker.verify(maria, NULLIFIER_MARIA);
        checker.verify(mariaNewPhone, NULLIFIER_MARIA);
        vm.stopPrank();

        // one human = one active wallet: new wallet works, old wallet is dead
        assertTrue(checker.checkAllowlist(mariaNewPhone, token) == PermissionFlags.ALL_ALLOWED);
        assertTrue(checker.checkAllowlist(maria, token) == PermissionFlags.NONE);
    }

    function test_migration_cannot_steal_wallet_bound_to_other_nullifier() public {
        uint256 nullifierAttacker = uint256(keccak256("attacker-world-id"));

        vm.startPrank(backend);
        checker.verify(maria, NULLIFIER_MARIA);
        vm.expectRevert(abi.encodeWithSelector(WorldAllowlistChecker.AccountAlreadyBound.selector, maria));
        checker.verify(maria, nullifierAttacker);
        vm.stopPrank();
    }
}

contract VoucherTest is Test {
    WorldAllowlistChecker checker;
    uint256 backendPk = 0xB0B;
    address backend;
    address maria = makeAddr("maria");
    address relayer = makeAddr("anyone");

    function setUp() public {
        backend = vm.addr(backendPk);
        checker = new WorldAllowlistChecker(backend);
    }

    function _sign(address account, uint256 nullifier, uint256 deadline) internal view returns (bytes memory) {
        bytes32 digest = checker.voucherDigest(account, nullifier, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(backendPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_anyone_can_submit_valid_voucher() public {
        bytes memory sig = _sign(maria, 111, block.timestamp + 600);
        vm.prank(relayer);
        checker.verifyWithVoucher(maria, 111, block.timestamp + 600, sig);
        assertTrue(checker.verified(maria));
    }

    function test_forged_voucher_reverts() public {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(0xBAD), checker.voucherDigest(maria, 111, block.timestamp + 600));
        vm.expectRevert(WorldAllowlistChecker.InvalidVoucher.selector);
        checker.verifyWithVoucher(maria, 111, block.timestamp + 600, abi.encodePacked(r, s, v));
    }

    function test_expired_voucher_reverts() public {
        uint256 deadline = block.timestamp + 1;
        bytes memory sig = _sign(maria, 111, deadline);
        vm.warp(block.timestamp + 2);
        vm.expectRevert(WorldAllowlistChecker.VoucherExpired.selector);
        checker.verifyWithVoucher(maria, 111, deadline, sig);
    }
}
