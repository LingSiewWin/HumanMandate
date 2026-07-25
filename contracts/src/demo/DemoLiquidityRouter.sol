// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMsgSender} from "v4-periphery/src/interfaces/IMsgSender.sol";
import {
    IPermissionsAdapter
} from "v4-periphery/src/hooks/permissionedPools/interfaces/IPermissionsAdapter.sol";
import {
    IPermissionsAdapterFactory
} from "v4-periphery/src/hooks/permissionedPools/interfaces/IPermissionsAdapterFactory.sol";

/// @notice Minimal liquidity router for the demo pool. Implements IMsgSender so the official
///         permissioned hook can attribute liquidity to the real LP, and settles the adapter
///         side with the official wrap pattern (transfer underlying to adapter →
///         wrapToPoolManager), mirroring MockPermissionedRouter._payPermissionedFromPayer.
contract DemoLiquidityRouter is IUnlockCallback, IMsgSender {
    using SafeERC20 for IERC20;

    error NotPoolManager();
    error NoSenderContext();

    IPoolManager public immutable manager;
    IPermissionsAdapterFactory public immutable factory;

    address private _sender;

    constructor(IPoolManager manager_, IPermissionsAdapterFactory factory_) {
        manager = manager_;
        factory = factory_;
    }

    function msgSender() external view returns (address) {
        if (_sender == address(0)) revert NoSenderContext();
        return _sender;
    }

    function addLiquidity(PoolKey calldata key, ModifyLiquidityParams calldata params) external {
        _sender = msg.sender;
        manager.unlock(abi.encode(key, params));
        _sender = address(0);
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();
        (PoolKey memory key, ModifyLiquidityParams memory params) =
            abi.decode(rawData, (PoolKey, ModifyLiquidityParams));

        (BalanceDelta delta,) = manager.modifyLiquidity(key, params, "");
        _settle(key.currency0, delta.amount0());
        _settle(key.currency1, delta.amount1());
        return "";
    }

    function _settle(Currency currency, int128 amount) internal {
        if (amount >= 0) return;
        uint256 owed = uint256(uint128(-amount));
        manager.sync(currency);

        address adapter = Currency.unwrap(currency);
        address underlying = factory.verifiedPermissionsAdapterOf(adapter);
        if (underlying != address(0)) {
            IERC20(underlying).safeTransferFrom(_sender, adapter, owed);
            IPermissionsAdapter(adapter).wrapToPoolManager(owed);
        } else {
            IERC20(Currency.unwrap(currency)).safeTransferFrom(_sender, address(manager), owed);
        }
        manager.settle();
    }
}
