// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHumanRegistry} from "./interfaces/IHumanRegistry.sol";

interface IAgentBook {
    /// @notice The World ID nullifier hash of the human who registered this agent; 0 if none.
    function lookupHuman(address agent) external view returns (uint256);
}

/// @notice Reads World's AgentBook from Solidity. The five projects listed on agentbook.world
///         all gate HTTP endpoints with the off-chain SDK; this reads the registry on-chain so
///         a contract can refuse to move money for an agent no human stands behind.
///
///         Known property of AgentBook, deliberately accounted for here: registration does not
///         prove the human controls the agent key — anyone Orb-verified may bind any address to
///         their own humanId. That allows griefing (re-binding someone's agent breaks their
///         mandate) but not theft: an attacker cannot make `lookupHuman` return a humanId that
///         is not their own, and a mandate only ever pays its fixed recipient.
contract AgentBookRegistry is IHumanRegistry {
    IAgentBook public immutable agentBook;

    constructor(IAgentBook agentBook_) {
        agentBook = agentBook_;
    }

    function humanOf(address account) external view returns (uint256) {
        return agentBook.lookupHuman(account);
    }
}
