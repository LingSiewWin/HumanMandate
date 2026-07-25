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

/// @notice Privilege escalation requires a fresh liveness proof. Routine spending under the
///         existing cap does not — that is the whole point of delegating to an agent.
///         Face ID does not unlock every tap; it unlocks the dangerous ones.
contract StepUpTest is Test {
    HumanMandate mandate;
    StepUpRegistry registry;
    StepUpUSD usd;

    uint256 livenessPk = 0x11FE;
    address liveness;

    address payer = makeAddr("payer");
    address recipient = makeAddr("recipient");
    address newRecipient = makeAddr("attacker-recipient");
    address agent = makeAddr("agent");

    uint256 constant HUMAN = uint256(keccak256("the-human"));
    uint128 constant CAP = 2e18;

    function setUp() public {
        liveness = vm.addr(livenessPk);
        registry = new StepUpRegistry();
        mandate = new HumanMandate(IHumanRegistry(address(registry)), liveness);
        usd = new StepUpUSD();
        usd.transfer(payer, 100e18);
        registry.set(agent, HUMAN);

        vm.prank(payer);
        usd.approve(address(mandate), type(uint256).max);
        vm.prank(payer);
        mandate.authorize(HUMAN, address(usd), CAP, recipient);
    }

    function _proof(address account, uint128 newCap, address newRecip, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(livenessPk, mandate.stepUpDigest(account, newCap, newRecip, deadline));
        return abi.encodePacked(r, s, v);
    }

    function test_routine_spending_needs_no_liveness() public {
        vm.prank(agent);
        mandate.pull(payer, 2e18);
        assertEq(usd.balanceOf(recipient), 2e18);
    }

    function test_raising_the_cap_without_liveness_reverts() public {
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(20e18, recipient, block.timestamp + 600, "");
    }

    function test_raising_the_cap_with_fresh_liveness_succeeds() public {
        uint256 deadline = block.timestamp + 600;
        // Build the proof first: vm.prank applies to the next call, and _proof itself calls
        // the mandate to read the digest.
        bytes memory proof = _proof(payer, 20e18, recipient, deadline);
        vm.prank(payer);
        mandate.raiseLimits(20e18, recipient, deadline, proof);

        vm.prank(agent);
        mandate.pull(payer, 20e18);
        assertEq(usd.balanceOf(recipient), 20e18);
    }

    /// @dev The attack this exists for: a stolen session key quietly redirects the money.
    function test_changing_the_recipient_requires_liveness() public {
        uint256 deadline = block.timestamp + 600;
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(CAP, newRecipient, deadline, "");
    }

    function test_a_proof_for_someone_else_is_rejected() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory otherProof = _proof(makeAddr("someone-else"), 20e18, recipient, deadline);
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(20e18, recipient, deadline, otherProof);
    }

    function test_a_stale_liveness_proof_is_rejected() public {
        uint256 deadline = block.timestamp + 1;
        bytes memory proof = _proof(payer, 20e18, recipient, deadline);
        vm.warp(block.timestamp + 2);
        vm.prank(payer);
        vm.expectRevert(HumanMandate.LivenessExpired.selector);
        mandate.raiseLimits(20e18, recipient, deadline, proof);
    }

    function test_a_liveness_proof_cannot_be_replayed() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory proof = _proof(payer, 20e18, recipient, deadline);
        vm.startPrank(payer);
        mandate.raiseLimits(20e18, recipient, deadline, proof);
        vm.expectRevert(HumanMandate.LivenessRequired.selector);
        mandate.raiseLimits(20e18, recipient, deadline, proof);
        vm.stopPrank();
    }

    /// @dev Lowering your own cap is de-escalation — never gated.
    function test_lowering_the_cap_needs_no_liveness() public {
        vm.prank(payer);
        mandate.lowerCap(1e18);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(HumanMandate.CapExceeded.selector, payer, 2e18, 1e18));
        mandate.pull(payer, 2e18);
    }
}
