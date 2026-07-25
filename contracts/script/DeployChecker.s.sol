// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {WorldAllowlistChecker} from "../src/WorldAllowlistChecker.sol";

/// @notice Usage: forge script script/DeployChecker.s.sol --rpc-url $RPC_URL --broadcast
///         Env: PRIVATE_KEY (deployer, throwaway hackathon wallet), BACKEND_SIGNER (checker owner;
///         defaults to deployer if unset).
contract DeployChecker is Script {
    function run() external returns (WorldAllowlistChecker checker) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address backendSigner = vm.envOr("BACKEND_SIGNER", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);
        checker = new WorldAllowlistChecker(backendSigner);
        vm.stopBroadcast();

        console2.log("WorldAllowlistChecker:", address(checker));
        console2.log("owner (backend signer):", backendSigner);
    }
}
