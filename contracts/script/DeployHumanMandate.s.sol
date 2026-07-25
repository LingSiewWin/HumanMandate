// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AgentBookRegistry, IAgentBook} from "../src/AgentBookRegistry.sol";
import {HumanMandate} from "../src/HumanMandate.sol";
import {IHumanRegistry} from "../src/interfaces/IHumanRegistry.sol";

/// @notice Deploys the mandate against World's real AgentBook on World Chain mainnet.
///         Env: PRIVATE_KEY. AGENT_BOOK defaults to the canonical mainnet deployment.
contract DeployHumanMandate is Script {
    function run() external returns (AgentBookRegistry registry, HumanMandate mandate) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address agentBook = vm.envOr("AGENT_BOOK", address(0xA23aB2712eA7BBa896930544C7d6636a96b944dA));

        vm.startBroadcast(deployerKey);
        registry = new AgentBookRegistry(IAgentBook(agentBook));
        mandate = new HumanMandate(IHumanRegistry(address(registry)));
        vm.stopBroadcast();

        console2.log("AgentBook:        ", agentBook);
        console2.log("AgentBookRegistry:", address(registry));
        console2.log("HumanMandate:     ", address(mandate));
    }
}
