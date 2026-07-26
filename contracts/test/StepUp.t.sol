// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {HumanMandate} from "../src/HumanMandate.sol";
import {IHumanRegistry} from "../src/interfaces/IHumanRegistry.sol";

contract StepUpUSD is ERC20 {
    constructor() ERC20("StepUp USD", "sUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract StepUpRegistry is IHumanRegistry {
    mapping(address => uint256) public human;

    function set(address a, uint256 h) external {
        human[a] = h;
    }

    function humanOf(address a) external view returns (uint256) {
        return human[a];
    }
}

/// @notice Widening a mandate requires a fresh liveness proof; spending inside it does not —
///         that is the point of delegating to an agent. Face ID does not unlock every tap, it
///         unlocks the dangerous ones.
///
///         The attestation is bound to account, mandate, amount AND payee (PSD2 RTS Art. 5
///         dynamic linking), so a compromised client cannot have a genuine face authorise a
///         different payee than the one the human saw.
contract StepUpTest is Test {
    HumanMandate mandate;
    StepUpRegistry registry;
    StepUpUSD usd;

    uint256 livenessPk = 0x11FE;
    address liveness;

    address payer = makeAddr("payer");
    address recipient = makeAddr("recipient");
    address attackerRecipient = makeAddr("attacker-recipient");
    address agent = makeAddr("agent");

    uint256 constant HUMAN = uint256(keccak256("the-human"));
    bytes32 constant CARD = keccak256("card");
    uint128 constant CAP = 2e18;

    // humanRef() is a contract call; computing it inside a pranked statement eats the prank.
    bytes32 refHuman;

    function setUp() public {
        liveness = vm.addr(livenessPk);
        registry = new StepUpRegistry();
        mandate = new HumanMandate(IHumanRegistry(address(registry)), liveness);
        usd = new StepUpUSD();
        usd.transfer(payer, 100e18);
        registry.set(agent, HUMAN);
        refHuman = mandate.humanRef(HUMAN);

        vm.prank(payer);
        usd.approve(address(mandate), type(uint256).max);
        vm.prank(payer);
        mandate.authorize(CARD, refHuman, address(usd), CAP, CAP, recipient);
    }

    /// @dev Build proofs BEFORE any vm.prank: this helper calls the contract to read the digest,
    ///      and a prank applies only to the next call.
    function _proof(address account, uint128 newCap, address newRecip, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(livenessPk, mandate.stepUpDigest(account, CARD, newCap, newRecip, deadline));
        return abi.encodePacked(r, s, v);
    }

    function test_routine_spending_needs_no_liveness() public {
        vm.prank(agent);
        mandate.pull(payer, CARD, 2e18);
        assertEq(usd.balanceOf(recipient), 2e18);
    }

    /// @dev SCOPE: raiseLimits is the ONLY widening path — authorize() refuses to overwrite a
    ///      live mandate (HumanMandateTest::test_authorize_cannot_overwrite_a_live_mandate).
    function test_raiseLimits_rejects_a_cap_increase_without_liveness() public {
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(CARD, 20e18, recipient, block.timestamp + 600, "");
    }

    function test_raiseLimits_rejects_a_recipient_change_without_liveness() public {
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(CARD, CAP, attackerRecipient, block.timestamp + 600, "");
    }

    function test_raising_the_cap_with_fresh_liveness_succeeds() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory proof = _proof(payer, 20e18, recipient, deadline);
        vm.prank(payer);
        mandate.raiseLimits(CARD, 20e18, recipient, deadline, proof);

        vm.prank(payer);
        mandate.lowerCap(CARD, 19e18); // per-tx cap still 2e18, so widen the window only
        vm.prank(agent);
        mandate.pull(payer, CARD, 2e18);
        assertEq(usd.balanceOf(recipient), 2e18);
    }

    /// @dev Dynamic linking: a proof for one payee cannot authorise another. This is the whole
    ///      reason step-up exists in payments — the face must agree to the payee, not just to
    ///      "some escalation".
    function test_a_proof_for_one_payee_cannot_move_money_to_another() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory proofForHonestPayee = _proof(payer, 20e18, recipient, deadline);
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(CARD, 20e18, attackerRecipient, deadline, proofForHonestPayee);
    }

    function test_a_proof_for_a_different_amount_is_rejected() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory proofFor20 = _proof(payer, 20e18, recipient, deadline);
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(CARD, 999e18, recipient, deadline, proofFor20);
    }

    function test_a_proof_for_someone_else_is_rejected() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory otherProof = _proof(makeAddr("someone-else"), 20e18, recipient, deadline);
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(CARD, 20e18, recipient, deadline, otherProof);
    }

    function test_a_stale_liveness_proof_is_rejected() public {
        uint256 deadline = block.timestamp + 1;
        bytes memory proof = _proof(payer, 20e18, recipient, deadline);
        vm.warp(block.timestamp + 2);
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessExpired.selector);
        mandate.raiseLimits(CARD, 20e18, recipient, deadline, proof);
    }

    /// @dev Replay reports LivenessAlreadyUsed, not LivenessRequired — the caller did have a
    ///      proof; they reused one.
    function test_a_liveness_proof_cannot_be_replayed() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory proof = _proof(payer, 20e18, recipient, deadline);
        vm.startPrank(payer);
        mandate.raiseLimits(CARD, 20e18, recipient, deadline, proof);
        vm.expectRevert(HumanMandate.LivenessAlreadyUsed.selector);
        mandate.raiseLimits(CARD, 20e18, recipient, deadline, proof);
        vm.stopPrank();
    }

    function test_lowering_the_cap_needs_no_liveness() public {
        vm.prank(payer);
        mandate.lowerCap(CARD, 1e18);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.CapExceeded.selector, payer, 2e18, 1e18));
        mandate.pull(payer, CARD, 2e18);
    }

    function test_lowerCap_refuses_a_raise_in_disguise() public {
        vm.prank(payer);
        vm.expectRevert(HumanMandate.NotLowering.selector);
        mandate.lowerCap(CARD, 99e18);
    }
}
