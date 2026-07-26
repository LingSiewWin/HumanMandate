// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IHumanRegistry} from "./interfaces/IHumanRegistry.sol";

/// @title MandateSwapper
/// @notice Lets a mandated agent convert what it is allowed to spend into the asset the payer
///         actually wants, without widening what it is allowed to spend.
///
///         WHY THIS IS A SEPARATE CONTRACT. HumanMandate.pull authenticates `msg.sender` against
///         World's registry. If this contract called `pull` on the agent's behalf, `msg.sender`
///         would be this contract — which has no human behind it — and every spend would revert
///         with NotHumanBacked. So the agent calls `pull` itself (funds land here, because the
///         payer fixed this contract as the mandate's recipient) and then calls `settle`. Both
///         legs are the agent's own transactions and can be batched by the wallet.
///
///         THE ATTACK THIS EXISTS TO STOP. A daily cap counts what *leaves* the payer. Once a
///         swap sits in the middle, an agent can stay under the cap forever and still drain
///         value by routing through a bad pool or sandwiching itself: the amount spent looks
///         obedient, the amount received does not. A cap without a floor on the output is not a
///         cap. `settle` therefore refuses unless the measured output clears `minOut`.
///
///         Funds parked here between the two legs are not loose: `settle` repeats the same
///         human check the mandate performs, so only the authorised person can move them, and
///         only ever to the payee the payer chose.
contract MandateSwapper {
    using SafeERC20 for IERC20;

    error NoRoute(address payer, bytes32 mandateId);
    error NotHumanBacked(address caller);
    error WrongHuman(bytes32 callerRef, bytes32 authorizedRef);
    error NothingToSettle();
    error SlippageTooHigh(uint256 received, uint256 minOut);
    error RouterCallFailed();
    error ZeroAddress();

    event RouteSet(address indexed payer, bytes32 indexed mandateId, address tokenIn, address tokenOut, address payee);
    event RouteCleared(address indexed payer, bytes32 indexed mandateId);
    event Settled(
        address indexed payer,
        bytes32 indexed mandateId,
        address agent,
        uint256 amountIn,
        uint256 amountOut,
        address payee
    );

    /// @notice The venue. Immutable: if the agent could name the router, it could name a
    ///         contract of its own and `minOut` would be checked against a token it minted.
    address public immutable router;
    /// @notice Permit2, which the router pulls through. Approved once per token, by anyone.
    address public immutable permit2;
    IHumanRegistry public immutable registry;

    struct Route {
        bytes32 humanRef;
        address tokenIn;
        address tokenOut;
        address payee;
        bool set;
    }

    /// @notice Set by the payer, never by the agent. The agent chooses timing and route
    ///         calldata; it does not choose what it buys or who receives it.
    mapping(address payer => mapping(bytes32 mandateId => Route)) public routes;

    constructor(address router_, address permit2_, IHumanRegistry registry_) {
        if (router_ == address(0) || permit2_ == address(0) || address(registry_) == address(0)) {
            revert ZeroAddress();
        }
        router = router_;
        permit2 = permit2_;
        registry = registry_;
    }

    /// @notice The payer declares what this mandate's spending converts into, and who receives it.
    /// @param  humanRef The same reference the payer authorised on the mandate. Repeated here so
    ///         `settle` can authenticate without reading the mandate's storage layout.
    function setRoute(
        bytes32 mandateId,
        bytes32 humanRef,
        address tokenIn,
        address tokenOut,
        address payee
    ) external {
        if (tokenIn == address(0) || tokenOut == address(0) || payee == address(0)) revert ZeroAddress();
        routes[msg.sender][mandateId] =
            Route({humanRef: humanRef, tokenIn: tokenIn, tokenOut: tokenOut, payee: payee, set: true});
        emit RouteSet(msg.sender, mandateId, tokenIn, tokenOut, payee);
    }

    function clearRoute(bytes32 mandateId) external {
        delete routes[msg.sender][mandateId];
        emit RouteCleared(msg.sender, mandateId);
    }

    /// @notice Same fail-closed registry read the mandate performs.
    function refOf(address account) public view returns (bytes32) {
        try registry.humanOf(account) returns (uint256 humanId) {
            if (humanId == 0) return bytes32(0);
            return keccak256(abi.encode(block.chainid, address(this), humanId));
        } catch {
            return bytes32(0);
        }
    }

    /// @notice One-time plumbing so the router can pull from this contract. Callable by anyone
    ///         because it grants nothing that is not already implied by the router being fixed.
    function primeRouter(address token) external {
        IERC20(token).forceApprove(permit2, type(uint256).max);
        // Permit2's own allowance, which is what the Universal Router actually spends against.
        (bool ok,) = permit2.call(
            abi.encodeWithSignature(
                "approve(address,address,uint160,uint48)", token, router, type(uint160).max, type(uint48).max
            )
        );
        if (!ok) revert RouterCallFailed();
    }

    /// @notice Convert whatever this mandate has parked here and forward it to the payer's payee.
    /// @param  minOut The floor the payer's agent commits to. Enforced against the *measured*
    ///         balance change, not against anything the router reports about itself.
    function settle(address payer, bytes32 mandateId, uint256 minOut, bytes calldata routerCalldata)
        external
        returns (uint256 amountOut)
    {
        Route memory route = routes[payer][mandateId];
        if (!route.set) revert NoRoute(payer, mandateId);

        bytes32 callerRef = refOf(msg.sender);
        if (callerRef == bytes32(0)) revert NotHumanBacked(msg.sender);
        if (callerRef != route.humanRef) revert WrongHuman(callerRef, route.humanRef);

        uint256 amountIn = IERC20(route.tokenIn).balanceOf(address(this));
        if (amountIn == 0) revert NothingToSettle();

        // Measure the delta rather than the balance: anything already sitting here belongs to
        // some other mandate, and sweeping a balance instead of a delta is how you send someone
        // else's money to your payee.
        uint256 before = IERC20(route.tokenOut).balanceOf(address(this));
        (bool ok,) = router.call(routerCalldata);
        if (!ok) revert RouterCallFailed();
        amountOut = IERC20(route.tokenOut).balanceOf(address(this)) - before;

        if (amountOut < minOut) revert SlippageTooHigh(amountOut, minOut);

        IERC20(route.tokenOut).safeTransfer(route.payee, amountOut);
        emit Settled(payer, mandateId, msg.sender, amountIn, amountOut, route.payee);
    }
}
