// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MandateSwapper} from "../src/MandateSwapper.sol";
import {IHumanRegistry} from "../src/interfaces/IHumanRegistry.sol";

/// @notice Env: PRIVATE_KEY, REGISTRY. ROUTER defaults to the address the Uniswap Trading API
///         returns as the `to` of a World Chain swap; PERMIT2 is the canonical deployment.
contract DeployMandateSwapper is Script {
    function run() external returns (MandateSwapper swapper) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address registry = vm.envAddress("REGISTRY");
        address router = vm.envOr("ROUTER", address(0x8ac7bEE993bb44dAb564Ea4bc9EA67Bf9Eb5e743));
        address permit2 = vm.envOr("PERMIT2", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));

        vm.startBroadcast(deployerKey);
        swapper = new MandateSwapper(router, permit2, IHumanRegistry(registry));
        vm.stopBroadcast();

        console2.log("MandateSwapper:", address(swapper));
        console2.log("router:        ", router);
        console2.log("registry:      ", registry);
    }
}
