// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {HumanMandate} from "../src/HumanMandate.sol";
import {IHumanRegistry} from "../src/interfaces/IHumanRegistry.sol";

contract TestUSD is ERC20 {
    constructor() ERC20("Test USD", "tUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}

/// @dev Stands in for World's AgentBook in unit tests. The real thing is exercised by the
///      fork test against World Chain mainnet.
contract MockRegistry is IHumanRegistry {
    mapping(address => uint256) public human;

    function set(address account, uint256 humanId) external {
        human[account] = humanId;
    }

    function humanOf(address account) external view returns (uint256) {
        return human[account];
    }
}

contract HumanMandateTest is Test {
    HumanMandate mandate;
    MockRegistry registry;
    TestUSD usd;

    address payer = makeAddr("payer");
    address recipient = makeAddr("recipient");
    address agentA = makeAddr("agent-a");
    address agentB = makeAddr("agent-b-fresh-address");
    address strangerAgent = makeAddr("stranger-agent");
    address unregistered = makeAddr("plain-wallet");

    uint256 constant OPERATOR = uint256(keccak256("operator-human"));
    uint256 constant STRANGER = uint256(keccak256("stranger-human"));
    uint128 constant CAP = 2e18;

    function setUp() public {
        registry = new MockRegistry();
        mandate = new HumanMandate(IHumanRegistry(address(registry)));
        usd = new TestUSD();
        usd.transfer(payer, 100e18);

        // Both agents belong to the SAME human — different addresses, one operator.
        registry.set(agentA, OPERATOR);
        registry.set(agentB, OPERATOR);
        registry.set(strangerAgent, STRANGER);

        vm.prank(payer);
        usd.approve(address(mandate), type(uint256).max);
        vm.prank(payer);
        mandate.authorize(OPERATOR, address(usd), CAP, recipient);
    }

    function test_agent_of_authorized_human_can_pull_within_cap() public {
        vm.prank(agentA);
        mandate.pull(payer, 2e18);
        assertEq(usd.balanceOf(recipient), 2e18);
    }

    function test_over_cap_reverts() public {
        vm.startPrank(agentA);
        mandate.pull(payer, 2e18);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.CapExceeded.selector, payer, 1, CAP));
        mandate.pull(payer, 1);
        vm.stopPrank();
    }

    /// @dev A second agent of the same human shares the human's budget — a fresh address
    ///      is not a fresh allowance.
    function test_second_agent_of_same_human_shares_the_cap() public {
        vm.prank(agentA);
        mandate.pull(payer, 2e18);
        vm.prank(agentB);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.CapExceeded.selector, payer, 1, CAP));
        mandate.pull(payer, 1);
    }

    function test_wallet_with_no_human_cannot_pull() public {
        vm.prank(unregistered);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotHumanBacked.selector, unregistered));
        mandate.pull(payer, 1e18);
    }

    function test_agent_of_a_different_human_cannot_pull() public {
        vm.prank(strangerAgent);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.WrongHuman.selector, STRANGER, OPERATOR));
        mandate.pull(payer, 1e18);
    }

    /// @dev THE MONEY SHOT: revocation binds to the human, so re-spawning the agent at a
    ///      brand-new address does not restore access. A card issuer cannot do this.
    function test_revoked_human_cannot_respawn_with_a_new_agent() public {
        vm.prank(agentA);
        mandate.pull(payer, 1e18);

        vm.prank(payer);
        mandate.revoke();

        vm.prank(agentB); // fresh address, never used before, same human
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotAuthorized.selector, payer));
        mandate.pull(payer, 1e18);
    }

    function test_cap_resets_next_day() public {
        vm.startPrank(agentA);
        mandate.pull(payer, 2e18);
        vm.warp(block.timestamp + 1 days);
        mandate.pull(payer, 2e18);
        vm.stopPrank();
        assertEq(usd.balanceOf(recipient), 4e18);
    }

    function test_funds_can_only_reach_the_fixed_recipient() public {
        vm.prank(agentA);
        mandate.pull(payer, 1e18);
        assertEq(usd.balanceOf(agentA), 0);
        assertEq(usd.balanceOf(recipient), 1e18);
    }

    function test_reauthorizing_a_different_human_locks_out_the_old_one() public {
        vm.prank(payer);
        mandate.authorize(STRANGER, address(usd), CAP, recipient);

        vm.prank(agentA);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.WrongHuman.selector, OPERATOR, STRANGER));
        mandate.pull(payer, 1e18);

        vm.prank(strangerAgent);
        mandate.pull(payer, 1e18);
        assertEq(usd.balanceOf(recipient), 1e18);
    }
}
