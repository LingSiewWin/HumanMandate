// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MandateSwapper} from "../src/MandateSwapper.sol";
import {IHumanRegistry} from "../src/interfaces/IHumanRegistry.sol";

contract TokenIn is ERC20 {
    constructor() ERC20("In", "IN") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract TokenOut is ERC20 {
    constructor() ERC20("Out", "OUT") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract SwapRegistry is IHumanRegistry {
    mapping(address => uint256) public human;

    function set(address a, uint256 h) external {
        human[a] = h;
    }

    function humanOf(address a) external view returns (uint256) {
        return human[a];
    }
}

/// @notice Stands in for the Universal Router. Pays out whatever rate the test sets, which is
///         how an unfavourable route is simulated without needing a live pool.
contract FakeRouter {
    TokenIn public tokenIn;
    TokenOut public tokenOut;
    uint256 public rateBps = 10_000;

    constructor(TokenIn in_, TokenOut out_) {
        tokenIn = in_;
        tokenOut = out_;
    }

    function setRate(uint256 bps) external {
        rateBps = bps;
    }

    function swap(address from, uint256 amount) external {
        tokenIn.transferFrom(from, address(this), amount);
        tokenOut.transfer(from, (amount * rateBps) / 10_000);
    }
}

contract MandateSwapperTest is Test {
    MandateSwapper swapper;
    SwapRegistry registry;
    TokenIn tokenIn;
    TokenOut tokenOut;
    FakeRouter router;

    address payer = makeAddr("payer");
    address payee = makeAddr("payee");
    address agent = makeAddr("agent");
    address stranger = makeAddr("stranger-agent");
    address nobody = makeAddr("no-human-wallet");

    uint256 constant HUMAN = uint256(keccak256("operator"));
    uint256 constant OTHER = uint256(keccak256("someone-else"));
    bytes32 constant CARD = keccak256("card");

    bytes32 refHuman;

    function setUp() public {
        tokenIn = new TokenIn();
        tokenOut = new TokenOut();
        router = new FakeRouter(tokenIn, tokenOut);
        registry = new SwapRegistry();
        swapper = new MandateSwapper(address(router), makeAddr("permit2"), IHumanRegistry(address(registry)));

        registry.set(agent, HUMAN);
        registry.set(stranger, OTHER);
        refHuman = swapper.refOf(agent);

        tokenOut.transfer(address(router), 500_000e18);

        vm.prank(payer);
        swapper.setRoute(CARD, refHuman, address(tokenIn), address(tokenOut), payee);

        // The mandate's pull would deposit here; do the deposit directly so this suite tests the
        // swapper in isolation.
        tokenIn.transfer(address(swapper), 10e18);
    }

    function _calldata(uint256 amount) internal view returns (bytes memory) {
        return abi.encodeWithSelector(FakeRouter.swap.selector, address(swapper), amount);
    }

    function _prime() internal {
        vm.prank(address(swapper));
        tokenIn.approve(address(router), type(uint256).max);
    }

    function test_agent_can_convert_and_the_payee_is_paid() public {
        _prime();
        vm.prank(agent);
        swapper.settle(payer, CARD, 9e18, _calldata(10e18));
        assertEq(tokenOut.balanceOf(payee), 10e18);
        assertEq(tokenOut.balanceOf(address(swapper)), 0);
    }

    /// @dev THE POINT OF THIS CONTRACT. The agent spends exactly what the cap allows, but routes
    ///      through a venue paying 60%. Under a cap alone this is a legal transaction. Here it
    ///      is refused, because a cap with no floor on the output is not a cap.
    function test_a_bad_route_is_refused_even_though_the_cap_was_respected() public {
        _prime();
        router.setRate(6_000);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(MandateSwapper.SlippageTooHigh.selector, 6e18, 9e18));
        swapper.settle(payer, CARD, 9e18, _calldata(10e18));
        assertEq(tokenOut.balanceOf(payee), 0);
    }

    function test_funds_parked_between_the_two_legs_cannot_be_taken_by_a_stranger() public {
        _prime();
        // refOf() is a call to the swapper. Computing it inside the expectRevert argument would
        // consume the prank, and the revert would come from the test contract instead of the
        // stranger — which reverts NotHumanBacked and would quietly pass for the wrong reason.
        bytes32 refStranger = swapper.refOf(stranger);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(MandateSwapper.WrongHuman.selector, refStranger, refHuman));
        swapper.settle(payer, CARD, 1, _calldata(10e18));
    }

    function test_a_wallet_with_no_human_cannot_settle() public {
        _prime();
        vm.prank(nobody);
        vm.expectRevert(abi.encodeWithSelector(MandateSwapper.NotHumanBacked.selector, nobody));
        swapper.settle(payer, CARD, 1, _calldata(10e18));
    }

    /// @dev The agent picks timing and route, never the destination.
    function test_the_agent_cannot_redirect_the_output() public {
        _prime();
        vm.prank(agent);
        swapper.settle(payer, CARD, 1, _calldata(10e18));
        assertEq(tokenOut.balanceOf(agent), 0);
        assertEq(tokenOut.balanceOf(payee), 10e18);
    }

    function test_payer_can_clear_the_route() public {
        vm.prank(payer);
        swapper.clearRoute(CARD);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(MandateSwapper.NoRoute.selector, payer, CARD));
        swapper.settle(payer, CARD, 1, _calldata(10e18));
    }

    function test_settling_with_nothing_parked_reverts() public {
        vm.prank(payer);
        swapper.setRoute(keccak256("empty"), refHuman, address(tokenOut), address(tokenIn), payee);
        vm.prank(agent);
        vm.expectRevert(MandateSwapper.NothingToSettle.selector);
        swapper.settle(payer, keccak256("empty"), 1, "");
    }

    function test_a_failing_router_call_reverts_rather_than_silently_paying_nothing() public {
        // No approval primed, so the router's transferFrom fails.
        vm.prank(agent);
        vm.expectRevert(MandateSwapper.RouterCallFailed.selector);
        swapper.settle(payer, CARD, 1, _calldata(10e18));
    }
}
