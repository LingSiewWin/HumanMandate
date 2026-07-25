// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WorldAllowlistChecker} from "../src/WorldAllowlistChecker.sol";
import {PermissionsAdapter} from "v4-periphery/src/hooks/permissionedPools/PermissionsAdapter.sol";
import {IPermissionsAdapter} from "v4-periphery/src/hooks/permissionedPools/interfaces/IPermissionsAdapter.sol";
import {PermissionFlags} from "v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";

contract StockToken is ERC20 {
    constructor() ERC20("Tokenized NVDA", "tNVDA") {
        _mint(msg.sender, 1_000_000e18);
    }
}

/// @notice Our checker plugged into Uniswap's official PermissionsAdapter.
///         `isAllowed(account, SWAP_ALLOWED) == false` is exactly the condition on which the
///         official PermissionedV4Router reverts with `Unauthorized()` — the demo money shot.
contract AdapterIntegrationTest is Test {
    WorldAllowlistChecker checker;
    PermissionsAdapter adapter;
    StockToken stock;

    address backend = makeAddr("backend");
    address poolManager = makeAddr("poolManager");
    address maria = makeAddr("maria");
    address stranger = makeAddr("stranger");

    uint256 constant NULLIFIER_MARIA = uint256(keccak256("maria-world-id"));

    function setUp() public {
        stock = new StockToken();
        checker = new WorldAllowlistChecker(backend);
        adapter = new PermissionsAdapter(IERC20(address(stock)), poolManager, backend, checker);
    }

    function test_adapter_accepts_our_checker() public view {
        assertEq(address(adapter.allowListChecker()), address(checker));
    }

    function test_unverified_wallet_is_not_allowed_to_swap() public view {
        assertFalse(adapter.isAllowed(stranger, PermissionFlags.SWAP_ALLOWED));
    }

    function test_verified_wallet_is_allowed_to_swap_and_lp() public {
        vm.prank(backend);
        checker.verify(maria, NULLIFIER_MARIA);

        assertTrue(adapter.isAllowed(maria, PermissionFlags.SWAP_ALLOWED));
        assertTrue(adapter.isAllowed(maria, PermissionFlags.LIQUIDITY_ALLOWED));
    }

    function test_revoked_wallet_loses_swap_permission() public {
        vm.startPrank(backend);
        checker.verify(maria, NULLIFIER_MARIA);
        checker.revoke(maria);
        vm.stopPrank();

        assertFalse(adapter.isAllowed(maria, PermissionFlags.SWAP_ALLOWED));
    }

    function test_unauthorized_wrapper_cannot_mint_to_pool_manager() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IPermissionsAdapter.UnauthorizedWrapper.selector, stranger));
        adapter.wrapToPoolManager(1e18);
    }
}
