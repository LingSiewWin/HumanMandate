// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {
    PermissionsAdapterFactory
} from "v4-periphery/src/hooks/permissionedPools/PermissionsAdapterFactory.sol";
import {PermissionsAdapter} from "v4-periphery/src/hooks/permissionedPools/PermissionsAdapter.sol";
import {
    IPermissionsAdapterFactory
} from "v4-periphery/src/hooks/permissionedPools/interfaces/IPermissionsAdapterFactory.sol";
import {IAllowlistChecker} from "v4-periphery/src/hooks/permissionedPools/interfaces/IAllowlistChecker.sol";
import {IV4Router} from "v4-periphery/src/interfaces/IV4Router.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {ActionConstants} from "v4-periphery/src/libraries/ActionConstants.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";
import {MockPermissionedHooks} from "v4-periphery/test/hooks/permissionedPools/mocks/MockPermissionedHooks.sol";
import {MockPermissionedRouter} from "v4-periphery/test/mocks/MockPermissionedRouter.sol";
import {HookMiner} from "v4-periphery/test/shared/HookMiner.sol";
import {Plan, Planner} from "v4-periphery/test/shared/Planner.sol";

import {WorldAllowlistChecker} from "../src/WorldAllowlistChecker.sol";
import {DemoAsset, DemoUSD} from "../src/demo/DemoTokens.sol";
import {DemoLiquidityRouter} from "../src/demo/DemoLiquidityRouter.sol";

/// @notice Deploys the full permissioned-pool demo stack to a public testnet and executes
///         a REAL verified swap. The unverified-revert demo tx is sent afterwards via cast
///         (a reverting tx would halt forge broadcast).
contract DeployDemoStack is Script {
    using Planner for Plan;

    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    IAllowanceTransfer constant PERMIT2 =
        IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    address constant WETH = 0x4200000000000000000000000000000000000006;
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        WorldAllowlistChecker checker = WorldAllowlistChecker(vm.envAddress("CHECKER_ADDRESS"));

        vm.startBroadcast(deployerKey);

        // 1. Core + factory + tokens
        PoolManager manager = new PoolManager(deployer);
        PermissionsAdapterFactory factory = new PermissionsAdapterFactory(address(manager));
        DemoAsset asset = new DemoAsset();
        DemoUSD usd = new DemoUSD();

        // 2. Adapter for the asset token, gated by OUR World ID checker
        PermissionsAdapter adapter = PermissionsAdapter(
            factory.createPermissionsAdapter(IERC20(address(asset)), deployer, IAllowlistChecker(address(checker)))
        );
        asset.approve(address(adapter), 1);
        adapter.depositForVerification(1);
        factory.verifyPermissionsAdapter(address(adapter));

        // 3. Official permissioned hook at a mined CREATE2 address (flags per PermissionedDeployers)
        uint160 flags = (1 << 13) | (1 << 11) | (1 << 7) | (1 << 6);
        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(MockPermissionedHooks).creationCode,
            abi.encode(IPoolManager(address(manager)), IPermissionsAdapterFactory(address(factory)))
        );
        MockPermissionedHooks hook = new MockPermissionedHooks{salt: salt}(
            IPoolManager(address(manager)), IPermissionsAdapterFactory(address(factory))
        );
        require(address(hook) == hookAddr, "hook address mismatch");

        // 4. Routers
        MockPermissionedRouter swapRouter =
            new MockPermissionedRouter(IPoolManager(address(manager)), PERMIT2, factory, IWETH9(WETH));
        DemoLiquidityRouter lpRouter =
            new DemoLiquidityRouter(IPoolManager(address(manager)), IPermissionsAdapterFactory(address(factory)));

        adapter.updateAllowedWrapper(address(swapRouter), true);
        adapter.updateAllowedWrapper(address(lpRouter), true);
        adapter.updateSwappingEnabled(true);

        // 5. Pool (adapter/dUSD) + liquidity — deployer must be allowlisted BEFORE LPing
        checker.verify(deployer, uint256(keccak256("demo-deployer-worldid")));

        (Currency c0, Currency c1) = address(adapter) < address(usd)
            ? (Currency.wrap(address(adapter)), Currency.wrap(address(usd)))
            : (Currency.wrap(address(usd)), Currency.wrap(address(adapter)));
        PoolKey memory key = PoolKey(c0, c1, 3000, 60, IHooks(address(hook)));
        manager.initialize(key, SQRT_PRICE_1_1);

        asset.approve(address(lpRouter), type(uint256).max);
        usd.approve(address(lpRouter), type(uint256).max);
        lpRouter.addLiquidity(key, ModifyLiquidityParams(-887220, 887220, 1_000e18, 0));

        // 6. REAL verified swap: buy the permissioned asset with 5 dUSD (María's $5)
        usd.approve(address(PERMIT2), type(uint256).max);
        PERMIT2.approve(address(usd), address(swapRouter), type(uint160).max, type(uint48).max);

        bool usdIsZero = Currency.unwrap(key.currency0) == address(usd);
        IV4Router.ExactInputSingleParams memory params =
            IV4Router.ExactInputSingleParams(key, usdIsZero, uint128(5e18), 0, 0, bytes(""));
        Plan memory plan = Planner.init();
        plan = plan.add(Actions.SWAP_EXACT_IN_SINGLE, abi.encode(params));
        bytes memory data = plan.finalizeSwap(
            Currency.wrap(address(usd)), Currency.wrap(address(adapter)), ActionConstants.MSG_SENDER
        );
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = data;
        uint256 assetBefore = asset.balanceOf(deployer);
        swapRouter.execute(hex"10", inputs, block.timestamp + 3600);
        uint256 assetAfter = asset.balanceOf(deployer);

        vm.stopBroadcast();

        console2.log("PoolManager:        ", address(manager));
        console2.log("Factory:            ", address(factory));
        console2.log("DemoAsset pASSET: ", address(asset));
        console2.log("DemoUSD dUSD:       ", address(usd));
        console2.log("PermissionsAdapter: ", address(adapter));
        console2.log("Hook:               ", address(hook));
        console2.log("SwapRouter:         ", address(swapRouter));
        console2.log("LpRouter:           ", address(lpRouter));
        console2.log("asset received:   ", assetAfter - assetBefore);
    }
}
