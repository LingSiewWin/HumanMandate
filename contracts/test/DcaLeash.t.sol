// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {DcaLeash} from "../src/DcaLeash.sol";

contract TestUSD is ERC20 {
    constructor() ERC20("Test USD", "tUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract DcaLeashTest is Test {
    DcaLeash leash;
    TestUSD usd;

    address maria = makeAddr("maria");
    address agent = makeAddr("agent");
    address executor = makeAddr("swap-executor");
    address stranger = makeAddr("stranger");

    uint128 constant DAILY_CAP = 2e18; // $2/day

    function setUp() public {
        leash = new DcaLeash();
        usd = new TestUSD();
        usd.transfer(maria, 100e18);
        vm.prank(maria);
        usd.approve(address(leash), type(uint256).max);
        vm.prank(maria);
        leash.authorize(agent, address(usd), DAILY_CAP, executor);
    }

    function test_agent_can_spend_within_daily_cap() public {
        vm.prank(agent);
        leash.pull(maria, 2e18);
        assertEq(usd.balanceOf(executor), 2e18);
    }

    function test_spend_over_cap_reverts() public {
        vm.startPrank(agent);
        leash.pull(maria, 2e18);
        vm.expectRevert(abi.encodeWithSelector(DcaLeash.CapExceeded.selector, maria, 1, DAILY_CAP));
        leash.pull(maria, 1);
        vm.stopPrank();
    }

    function test_cap_resets_next_day() public {
        vm.startPrank(agent);
        leash.pull(maria, 2e18);
        vm.warp(block.timestamp + 1 days);
        leash.pull(maria, 2e18);
        vm.stopPrank();
        assertEq(usd.balanceOf(executor), 4e18);
    }

    function test_only_authorized_agent_can_pull() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DcaLeash.NotAgent.selector, maria, stranger));
        leash.pull(maria, 1e18);
    }

    function test_one_tap_revoke_kills_agent() public {
        vm.prank(maria);
        leash.revoke();
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DcaLeash.NotAuthorized.selector, maria));
        leash.pull(maria, 1e18);
    }

    function test_funds_only_flow_to_fixed_recipient() public {
        // the agent cannot choose a destination — recipient is locked at authorization time
        vm.prank(agent);
        leash.pull(maria, 1e18);
        assertEq(usd.balanceOf(agent), 0);
        assertEq(usd.balanceOf(executor), 1e18);
    }

    function test_reauthorize_overwrites_and_resets() public {
        address newAgent = makeAddr("new-agent");
        vm.prank(maria);
        leash.authorize(newAgent, address(usd), 5e18, executor);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(DcaLeash.NotAgent.selector, maria, agent));
        leash.pull(maria, 1e18);
        vm.prank(newAgent);
        leash.pull(maria, 5e18);
        assertEq(usd.balanceOf(executor), 5e18);
    }
}
