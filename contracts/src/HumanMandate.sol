// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IHumanRegistry} from "./interfaces/IHumanRegistry.sol";

/// @title HumanMandate
/// @notice A spending mandate granted to a *person*, not to an address.
///
///         Cards, bank mandates and token allowances all bind to a credential or an account,
///         so the party you cut off comes back under a new one. Here the payer authorizes an
///         anonymous human identifier — World's AgentBook nullifier for an agent operator, or
///         a World ID nullifier for a wallet — and every rule is enforced against that human:
///         the daily cap is the human's, the revocation is the human's. A revoked operator
///         spinning up a brand-new agent address gains nothing.
///
///         Custody never moves: the contract holds an allowance, not the payer's funds, and
///         can only ever send to the recipient fixed at authorization time.
contract HumanMandate {
    using SafeERC20 for IERC20;

    error NotAuthorized(address payer);
    error NotHumanBacked(address caller);
    error WrongHuman(uint256 callerHuman, uint256 authorizedHuman);
    error CapExceeded(address payer, uint256 requested, uint128 dailyCap);
    error ZeroAddress();
    error ZeroCap();
    error ZeroHuman();

    event Authorized(
        address indexed payer, uint256 indexed humanId, address token, uint128 dailyCap, address recipient
    );
    event Revoked(address indexed payer, uint256 indexed humanId);
    event Pulled(address indexed payer, uint256 indexed humanId, address agent, uint256 amount, address recipient);

    struct Mandate {
        uint256 humanId;
        address token;
        address recipient;
        uint128 dailyCap;
        uint128 spentToday;
        uint64 day;
        bool active;
    }

    IHumanRegistry public immutable registry;

    mapping(address payer => Mandate) public mandates;

    constructor(IHumanRegistry registry_) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
    }

    /// @notice Authorize a human (not an address) to spend up to `dailyCap` per day,
    ///         and only into `recipient`.
    function authorize(uint256 humanId, address token, uint128 dailyCap, address recipient) external {
        if (humanId == 0) revert ZeroHuman();
        if (token == address(0) || recipient == address(0)) revert ZeroAddress();
        if (dailyCap == 0) revert ZeroCap();

        mandates[msg.sender] = Mandate({
            humanId: humanId,
            token: token,
            recipient: recipient,
            dailyCap: dailyCap,
            spentToday: 0,
            day: uint64(block.timestamp / 1 days),
            active: true
        });
        emit Authorized(msg.sender, humanId, token, dailyCap, recipient);
    }

    /// @notice Cut the human off. Every agent they operate, present and future, loses access
    ///         in the same transaction.
    function revoke() external {
        Mandate storage mandate = mandates[msg.sender];
        mandate.active = false;
        emit Revoked(msg.sender, mandate.humanId);
    }

    /// @notice Called by an agent. The caller's human — not the caller's address — must match
    ///         the mandate, and the human's daily budget must cover the amount.
    function pull(address payer, uint256 amount) external {
        Mandate storage mandate = mandates[payer];
        if (!mandate.active) revert NotAuthorized(payer);

        uint256 callerHuman = registry.humanOf(msg.sender);
        if (callerHuman == 0) revert NotHumanBacked(msg.sender);
        if (callerHuman != mandate.humanId) revert WrongHuman(callerHuman, mandate.humanId);

        uint64 today = uint64(block.timestamp / 1 days);
        if (today != mandate.day) {
            mandate.day = today;
            mandate.spentToday = 0;
        }
        if (amount + mandate.spentToday > mandate.dailyCap) {
            revert CapExceeded(payer, amount, mandate.dailyCap);
        }
        mandate.spentToday += uint128(amount);

        IERC20(mandate.token).safeTransferFrom(payer, mandate.recipient, amount);
        emit Pulled(payer, callerHuman, msg.sender, amount, mandate.recipient);
    }
}
