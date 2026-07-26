// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AgentBookRegistry, IAgentBook} from "../src/AgentBookRegistry.sol";
import {HumanMandate} from "../src/HumanMandate.sol";
import {IHumanRegistry} from "../src/interfaces/IHumanRegistry.sol";

/// @notice Deploys the mandate against World's real AgentBook on World Chain mainnet.
///         Env: PRIVATE_KEY, LIVENESS_ATTESTOR. AGENT_BOOK defaults to the canonical
///         mainnet deployment.
contract DeployHumanMandate is Script {
    /// @dev The attestor signs step-up approvals; the deployer holds funds. Defaulting one to
    ///      the other would mean a single stolen key both drains the wallet and forges the
    ///      liveness proofs that widen every mandate — so this refuses to guess.
    error AttestorMustBeSeparateFromDeployer();

    function run() external returns (AgentBookRegistry registry, HumanMandate mandate) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address agentBook = vm.envOr("AGENT_BOOK", address(0xA23aB2712eA7BBa896930544C7d6636a96b944dA));
        address livenessAttestor = vm.envAddress("LIVENESS_ATTESTOR");
        if (livenessAttestor == vm.addr(deployerKey)) revert AttestorMustBeSeparateFromDeployer();

        vm.startBroadcast(deployerKey);
        registry = new AgentBookRegistry(IAgentBook(agentBook));
        mandate = new HumanMandate(IHumanRegistry(address(registry)), livenessAttestor);
        vm.stopBroadcast();

        console2.log("AgentBook:        ", agentBook);
        console2.log("AgentBookRegistry:", address(registry));
        console2.log("HumanMandate:     ", address(mandate));
        console2.log("LivenessAttestor: ", livenessAttestor);
    }
}
