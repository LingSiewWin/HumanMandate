// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {CustomRevert} from "@uniswap/v4-core/src/libraries/CustomRevert.sol";
import {IHooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IV4Router} from "v4-periphery/src/interfaces/IV4Router.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {ActionConstants} from "v4-periphery/src/libraries/ActionConstants.sol";
import {
    PermissionedRoutingTestHelpers
} from "v4-periphery/test/hooks/permissionedPools/shared/PermissionedRoutingTestHelpers.sol";
import {Planner} from "v4-periphery/test/shared/Planner.sol";
import {MockPermissionedToken} from "v4-periphery/test/hooks/permissionedPools/PermissionedPoolsBase.sol";
import {PermissionFlags} from "v4-periphery/src/hooks/permissionedPools/libraries/PermissionFlags.sol";

import {WorldAllowlistChecker} from "../src/WorldAllowlistChecker.sol";

// Imported only so forge compiles the artifacts that the official helpers load via vm.getCode
import {
    PermissionsAdapterFactory
} from "v4-periphery/src/hooks/permissionedPools/PermissionsAdapterFactory.sol";
import {
    PermissionedPositionManager
} from "v4-periphery/src/hooks/permissionedPools/PermissionedPositionManager.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PositionDescriptor} from "v4-periphery/src/PositionDescriptor.sol";
import {MockPermissionedRouter} from "v4-periphery/test/mocks/MockPermissionedRouter.sol";
import {
    MockPermissionedHooks
} from "v4-periphery/test/hooks/permissionedPools/mocks/MockPermissionedHooks.sol";
import {
    MockInsecureHooks
} from "v4-periphery/test/hooks/permissionedPools/mocks/MockInsecureHooks.sol";
import {
    TransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// @notice End-to-end: our World ID checker plugged into the full official permissioned-pools
///         stack (PoolManager + PermissionsAdapter + PermissionedV4Router + official hooks).
///         Verified wallet swaps; unverified wallet is reverted by the pool's own hook.
contract WorldCheckerE2ETest is PermissionedRoutingTestHelpers {
    // mirrored for expectRevert encoding (as in official tests)
    error Unauthorized();
    error HookCallFailed();

    WorldAllowlistChecker worldChecker;

    address backend = makeAddr("backend");
    address maria = makeAddr("MARIA");
    address unverifiedWallet = makeAddr("UNVERIFIED");

    bytes constant COMMAND_V4_SWAP = hex"10";

    Currency adapter0Currency;
    Currency adapter1Currency;

    function setUp() public {
        setupPermissionedRouterCurrenciesAndPoolsWithLiquidity(maria);

        adapter0Currency = Currency.wrap(address(permissionsAdapter0));
        adapter1Currency = Currency.wrap(address(permissionsAdapter1));
        permissionsAdapter0.updateSwappingEnabled(true);
        permissionsAdapter1.updateSwappingEnabled(true);
        plan = Planner.init();

        // Replace the mock checker with OUR World ID checker on both official adapters
        worldChecker = new WorldAllowlistChecker(backend);
        permissionsAdapter0.updateAllowListChecker(worldChecker);
        permissionsAdapter1.updateAllowListChecker(worldChecker);

        // Backend verified María's ZK proof off-chain → registers her wallet on-chain
        vm.prank(backend);
        worldChecker.verify(maria, uint256(keccak256("maria-world-id")));

        // Fund both wallets with the permissioned tokens and set token-level
        // transfer allowance — so the ONLY thing separating them is the World ID credential
        _fundAndAllow(maria);
        _fundAndAllow(unverifiedWallet);
        _approveAs(maria);
        _approveAs(unverifiedWallet);
    }

    function _fundAndAllow(address wallet) internal {
        MockPermissionedToken(Currency.unwrap(currency0)).setTokenAllowlist(wallet, true);
        MockPermissionedToken(Currency.unwrap(currency1)).setTokenAllowlist(wallet, true);
        assertTrue(IERC20(Currency.unwrap(currency0)).transfer(wallet, 2 ether));
        assertTrue(IERC20(Currency.unwrap(currency1)).transfer(wallet, 2 ether));
    }

    function _approveAs(address wallet) internal {
        vm.startPrank(wallet);
        IERC20(Currency.unwrap(currency0)).approve(address(permit2), type(uint256).max);
        IERC20(Currency.unwrap(currency1)).approve(address(permit2), type(uint256).max);
        IERC20(Currency.unwrap(currency0)).approve(address(permissionedRouter), type(uint256).max);
        IERC20(Currency.unwrap(currency1)).approve(address(permissionedRouter), type(uint256).max);
        permit2.approve(Currency.unwrap(currency0), address(permissionedRouter), type(uint160).max, 2 ** 47);
        permit2.approve(Currency.unwrap(currency1), address(permissionedRouter), type(uint160).max, 2 ** 47);
        vm.stopPrank();
    }

    function _swapPlan() internal returns (bytes memory data) {
        IV4Router.ExactInputSingleParams memory params =
            IV4Router.ExactInputSingleParams(key0, true, uint128(1000), 0, 0, bytes(""));
        plan = plan.add(Actions.SWAP_EXACT_IN_SINGLE, abi.encode(params));
        data = plan.finalizeSwap(key0.currency0, key0.currency1, ActionConstants.MSG_SENDER);
    }

    function test_verified_wallet_swap_succeeds() public {
        Currency outputUnderlying = getPermissionedCurrency(key0.currency1);
        uint256 balanceBefore = outputUnderlying.balanceOf(maria);

        bytes memory data = _swapPlan();
        vm.prank(maria);
        permissionedRouter.execute(COMMAND_V4_SWAP, toBytesArray(data), type(uint256).max);

        assertGt(outputUnderlying.balanceOf(maria), balanceBefore);
    }

    function test_unverified_wallet_same_swap_reverts_onchain() public {
        bytes memory data = _swapPlan();

        vm.prank(unverifiedWallet);
        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(permissionedHooks),
                IHooks.beforeSwap.selector,
                abi.encodeWithSelector(Unauthorized.selector),
                abi.encodeWithSelector(HookCallFailed.selector)
            )
        );
        permissionedRouter.execute(COMMAND_V4_SWAP, toBytesArray(data), type(uint256).max);
    }

    /// @dev Negative control: this wallet carries FULL permissions in the mock token's own
    ///      allowlist (which the original MockAllowlistChecker would honor) — if the pool were
    ///      still consulting anything other than OUR checker, this swap would succeed and this
    ///      test would fail.
    function test_wallet_allowed_by_token_map_but_not_by_world_id_still_reverts() public {
        address tokenBlessedWallet = makeAddr("TOKEN_BLESSED");
        MockPermissionedToken(Currency.unwrap(currency0)).setAllowlist(tokenBlessedWallet, PermissionFlags.ALL_ALLOWED);
        MockPermissionedToken(Currency.unwrap(currency1)).setAllowlist(tokenBlessedWallet, PermissionFlags.ALL_ALLOWED);
        assertTrue(IERC20(Currency.unwrap(currency0)).transfer(tokenBlessedWallet, 2 ether));
        assertTrue(IERC20(Currency.unwrap(currency1)).transfer(tokenBlessedWallet, 2 ether));
        _approveAs(tokenBlessedWallet);

        bytes memory data = _swapPlan();
        vm.prank(tokenBlessedWallet);
        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(permissionedHooks),
                IHooks.beforeSwap.selector,
                abi.encodeWithSelector(Unauthorized.selector),
                abi.encodeWithSelector(HookCallFailed.selector)
            )
        );
        permissionedRouter.execute(COMMAND_V4_SWAP, toBytesArray(data), type(uint256).max);
    }

    function test_revoked_wallet_loses_swap_access() public {
        // María swaps fine, gets revoked, then the pool rejects her next identical swap
        bytes memory data = _swapPlan();
        vm.prank(maria);
        permissionedRouter.execute(COMMAND_V4_SWAP, toBytesArray(data), type(uint256).max);

        vm.prank(backend);
        worldChecker.revoke(maria);

        plan = Planner.init();
        bytes memory data2 = _swapPlan();
        vm.prank(maria);
        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(permissionedHooks),
                IHooks.beforeSwap.selector,
                abi.encodeWithSelector(Unauthorized.selector),
                abi.encodeWithSelector(HookCallFailed.selector)
            )
        );
        permissionedRouter.execute(COMMAND_V4_SWAP, toBytesArray(data2), type(uint256).max);
    }
}
