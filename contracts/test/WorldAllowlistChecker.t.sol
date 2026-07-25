// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {WorldAllowlistChecker} from "../src/WorldAllowlistChecker.sol";
import {IAllowlistChecker} from "v4-periphery/src/hooks/permissionedPools/interfaces/IAllowlistChecker.sol";
import {
    PermissionFlag,
    PermissionFlags
} from "v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WorldAllowlistCheckerTest is Test {
    WorldAllowlistChecker checker;

    address backend = makeAddr("backend");
    address maria = makeAddr("maria");
    address stranger = makeAddr("stranger");
    address token = makeAddr("stockToken");

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

    function test_verify_reverts_on_reused_nullifier() public {
        vm.startPrank(backend);
        checker.verify(maria, NULLIFIER_MARIA);
        vm.expectRevert(
            abi.encodeWithSelector(WorldAllowlistChecker.NullifierAlreadyUsed.selector, NULLIFIER_MARIA)
        );
        checker.verify(stranger, NULLIFIER_MARIA);
        vm.stopPrank();
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
}
