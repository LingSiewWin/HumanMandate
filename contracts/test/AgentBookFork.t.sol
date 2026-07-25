// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AgentBookRegistry, IAgentBook} from "../src/AgentBookRegistry.sol";
import {HumanMandate} from "../src/HumanMandate.sol";
import {IHumanRegistry} from "../src/interfaces/IHumanRegistry.sol";

contract ForkUSD is ERC20 {
    constructor() ERC20("Fork USD", "fUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}

/// @notice Runs against the REAL AgentBook on World Chain mainnet — no mock registry.
///         AgentBook: 0xA23aB2712eA7BBa896930544C7d6636a96b944dA
contract AgentBookForkTest is Test {
    address constant AGENT_BOOK = 0xA23aB2712eA7BBa896930544C7d6636a96b944dA;
    // An agent address registered on mainnet by a real Orb-verified human.
    address constant REGISTERED_AGENT = 0x7AEa10Ebc47CC8F2eb359B2e19a6286Ef36A59e6;
    address constant NEVER_REGISTERED = 0x1234567890AbcdEF1234567890aBcdef12345678;

    AgentBookRegistry registry;
    HumanMandate mandate;
    ForkUSD usd;
    address payer = makeAddr("payer");
    address recipient = makeAddr("recipient");

    function setUp() public {
        vm.createSelectFork("https://worldchain-mainnet.g.alchemy.com/public");
        registry = new AgentBookRegistry(IAgentBook(AGENT_BOOK));
        mandate = new HumanMandate(IHumanRegistry(address(registry)), makeAddr("liveness-attestor"));
        usd = new ForkUSD();
        usd.transfer(payer, 100e18);
        vm.prank(payer);
        usd.approve(address(mandate), type(uint256).max);
    }

    function test_reads_a_real_humanId_from_mainnet_agentbook() public view {
        uint256 humanId = registry.humanOf(REGISTERED_AGENT);
        assertGt(humanId, 0, "registered agent must resolve to a human");
        assertEq(registry.humanOf(NEVER_REGISTERED), 0, "unregistered agent must resolve to 0");
    }

    function test_real_registered_agent_can_spend_under_a_mandate() public {
        uint256 humanId = registry.humanOf(REGISTERED_AGENT);
        vm.prank(payer);
        mandate.authorize(humanId, address(usd), 2e18, recipient);

        vm.prank(REGISTERED_AGENT);
        mandate.pull(payer, 2e18);
        assertEq(usd.balanceOf(recipient), 2e18);
    }

    function test_wallet_no_human_stands_behind_is_refused_by_real_registry() public {
        uint256 humanId = registry.humanOf(REGISTERED_AGENT);
        vm.prank(payer);
        mandate.authorize(humanId, address(usd), 2e18, recipient);

        vm.prank(NEVER_REGISTERED);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotHumanBacked.selector, NEVER_REGISTERED));
        mandate.pull(payer, 1e18);
    }

    function test_revocation_holds_against_the_real_registry() public {
        uint256 humanId = registry.humanOf(REGISTERED_AGENT);
        vm.prank(payer);
        mandate.authorize(humanId, address(usd), 2e18, recipient);
        vm.prank(REGISTERED_AGENT);
        mandate.pull(payer, 1e18);

        vm.prank(payer);
        mandate.revoke();

        vm.prank(REGISTERED_AGENT);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotAuthorized.selector, payer));
        mandate.pull(payer, 1e18);
    }
}
