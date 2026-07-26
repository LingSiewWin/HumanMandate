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

/// @dev Stands in for World's AgentBook in unit tests. The real registry is exercised by
///      AgentBookFork.t.sol against World Chain mainnet.
contract MockRegistry is IHumanRegistry {
    mapping(address => uint256) public human;
    bool public broken;

    function set(address account, uint256 humanId) external {
        human[account] = humanId;
    }

    function breakIt() external {
        broken = true;
    }

    function humanOf(address account) external view returns (uint256) {
        require(!broken, "registry down");
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
    bytes32 constant CARD = keccak256("groceries-agent");
    bytes32 constant CARD2 = keccak256("travel-agent");
    uint128 constant CAP = 2e18;

    // Precomputed: humanRef() is a call to the mandate, and vm.prank applies only to the
    // next call — computing it inline inside a pranked statement silently eats the prank.
    bytes32 refOperator;
    bytes32 refStranger;

    function setUp() public {
        registry = new MockRegistry();
        mandate = new HumanMandate(IHumanRegistry(address(registry)), makeAddr("liveness-attestor"));
        usd = new TestUSD();
        usd.transfer(payer, 100e18);

        // Both agents belong to the SAME human — different addresses, one operator.
        registry.set(agentA, OPERATOR);
        registry.set(agentB, OPERATOR);
        registry.set(strangerAgent, STRANGER);
        refOperator = mandate.humanRef(OPERATOR);
        refStranger = mandate.humanRef(STRANGER);

        vm.prank(payer);
        usd.approve(address(mandate), type(uint256).max);
        vm.prank(payer);
        mandate.authorize(CARD, refOperator, address(usd), CAP, CAP, recipient);
    }

    function test_agent_of_authorized_human_can_spend_within_cap() public {
        vm.prank(agentA);
        mandate.pull(payer, CARD, 2e18);
        assertEq(usd.balanceOf(recipient), 2e18);
    }

    /// @dev THE CLAIM: an address the mandate never named, never approved, spends anyway —
    ///      because its *human* was authorised. No card and no ERC-20 allowance can do this.
    function test_an_address_never_named_in_the_mandate_can_spend() public {
        assertEq(usd.balanceOf(recipient), 0);
        vm.prank(agentB); // never mentioned at authorize time, never approved
        mandate.pull(payer, CARD, 1e18);
        assertEq(usd.balanceOf(recipient), 1e18);
    }

    /// @dev The other half of the pair: the registry check is actually reached. An address with
    ///      no human behind it dies on NotHumanBacked, not on some earlier guard.
    function test_a_wallet_with_no_human_dies_on_the_registry_check() public {
        vm.prank(unregistered);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotHumanBacked.selector, unregistered));
        mandate.pull(payer, CARD, 1e18);
    }

    function test_agent_of_a_different_human_cannot_spend() public {
        vm.prank(strangerAgent);
        vm.expectRevert(
            abi.encodeWithSelector(
                HumanMandate.WrongHuman.selector, refStranger, refOperator
            )
        );
        mandate.pull(payer, CARD, 1e18);
    }

    function test_over_cap_reverts() public {
        vm.startPrank(agentA);
        mandate.pull(payer, CARD, 2e18);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.CapExceeded.selector, payer, 1, CAP));
        mandate.pull(payer, CARD, 1);
        vm.stopPrank();
    }

    /// @dev A fresh address is not a fresh allowance: agents of one human share one budget.
    function test_second_agent_of_same_human_shares_the_cap() public {
        vm.prank(agentA);
        mandate.pull(payer, CARD, 2e18);
        vm.prank(agentB);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.CapExceeded.selector, payer, 1, CAP));
        mandate.pull(payer, CARD, 1);
    }

    function test_revoked_human_cannot_respawn_with_a_new_agent() public {
        vm.prank(agentA);
        mandate.pull(payer, CARD, 1e18);

        vm.prank(payer);
        mandate.revoke(CARD);

        vm.prank(agentB);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotAuthorized.selector, payer, CARD));
        mandate.pull(payer, CARD, 1e18);
    }

    // --- fixes for the audit findings ---

    /// @dev authorize() must not be an ungated raiseLimits. Re-arming a live mandate would let
    ///      anyone widen the cap, move the payee and zero the spend counter with no liveness.
    function test_authorize_cannot_overwrite_a_live_mandate() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.AlreadyActive.selector, payer, CARD));
        mandate.authorize(CARD, refOperator, address(usd), 999e18, 999e18, makeAddr("attacker"));
    }

    function test_authorize_works_again_after_an_explicit_revoke() public {
        vm.startPrank(payer);
        mandate.revoke(CARD);
        mandate.authorize(CARD, refOperator, address(usd), 5e18, 5e18, recipient);
        vm.stopPrank();
        vm.prank(agentA);
        mandate.pull(payer, CARD, 5e18);
        assertEq(usd.balanceOf(recipient), 5e18);
    }

    /// @dev The window runs 24h from the first spend, so two full caps cannot clear seconds
    ///      apart across a UTC midnight.
    function test_cap_does_not_reset_at_utc_midnight() public {
        vm.warp(1_800_000_000 - 1); // one second before a day boundary
        vm.startPrank(payer);
        mandate.revoke(CARD);
        mandate.authorize(CARD, refOperator, address(usd), CAP, CAP, recipient);
        vm.stopPrank();

        vm.prank(agentA);
        mandate.pull(payer, CARD, 2e18);

        vm.warp(block.timestamp + 2); // crossed midnight
        vm.prank(agentA);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.CapExceeded.selector, payer, 1e18, CAP));
        mandate.pull(payer, CARD, 1e18);
    }

    function test_cap_resets_a_full_window_after_the_first_spend() public {
        vm.prank(agentA);
        mandate.pull(payer, CARD, 2e18);
        vm.warp(block.timestamp + 1 days);
        vm.prank(agentA);
        mandate.pull(payer, CARD, 2e18);
        assertEq(usd.balanceOf(recipient), 4e18);
    }

    /// @dev One payer, many mandates — the company-card shape. Budgets are independent.
    function test_two_mandates_have_independent_budgets() public {
        vm.prank(payer);
        mandate.authorize(CARD2, refOperator, address(usd), 5e18, 5e18, recipient);

        vm.startPrank(agentA);
        mandate.pull(payer, CARD, 2e18);
        mandate.pull(payer, CARD2, 5e18);
        vm.stopPrank();
        assertEq(usd.balanceOf(recipient), 7e18);

        vm.prank(payer);
        mandate.revoke(CARD);

        vm.startPrank(agentA);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotAuthorized.selector, payer, CARD));
        mandate.pull(payer, CARD, 1);
        vm.stopPrank();
    }

    function test_per_transaction_cap_stops_a_single_large_drain() public {
        vm.startPrank(payer);
        mandate.revoke(CARD);
        mandate.authorize(CARD, refOperator, address(usd), 10e18, 1e18, recipient);
        vm.stopPrank();

        vm.prank(agentA);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.PerTxCapExceeded.selector, 10e18, 1e18));
        mandate.pull(payer, CARD, 10e18);
    }

    function test_zero_amount_pull_is_rejected() public {
        vm.prank(agentA);
        vm.expectRevert(HumanMandate.ZeroAmount.selector);
        mandate.pull(payer, CARD, 0);
    }

    /// @dev Anyone could previously emit Revoked for a mandate that never existed.
    function test_revoking_a_mandate_that_never_existed_reverts() public {
        address nobody = makeAddr("nobody");
        vm.prank(nobody);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotAuthorized.selector, nobody, CARD));
        mandate.revoke(CARD);
    }

    /// @dev If World's registry breaks, spending stops rather than the contract bricking on a
    ///      bubbled revert. Fail-closed is the safe direction for a spending mandate.
    function test_a_broken_registry_fails_closed() public {
        registry.breakIt();
        vm.prank(agentA);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.NotHumanBacked.selector, agentA));
        mandate.pull(payer, CARD, 1e18);
    }

    /// @dev The raw World ID nullifier must never be derivable from what we store or emit
    ///      without also knowing the deployment — the reference is chain- and contract-scoped.
    function test_human_reference_is_scoped_to_this_deployment() public {
        HumanMandate other = new HumanMandate(IHumanRegistry(address(registry)), makeAddr("other-attestor"));
        assertTrue(mandate.humanRef(OPERATOR) != other.humanRef(OPERATOR));
        assertEq(mandate.humanRef(0), bytes32(0));
    }

    function test_funds_can_only_reach_the_fixed_recipient() public {
        vm.prank(agentA);
        mandate.pull(payer, CARD, 1e18);
        assertEq(usd.balanceOf(agentA), 0);
        assertEq(usd.balanceOf(recipient), 1e18);
    }
}
