// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title DcaLeash
/// @notice The user's AI agent gets exactly three things and nothing more: a daily spend cap,
///         a fixed destination for funds, and an existence that ends with one tap. Custody
///         never leaves the user's wallet — the leash only holds an allowance.
///         AgentKit (if wired) proves the agent is human-backed; THIS contract decides what
///         that human actually allowed it to do.
contract DcaLeash {
    using SafeERC20 for IERC20;

    error NotAuthorized(address user);
    error NotAgent(address user, address caller);
    error CapExceeded(address user, uint256 requested, uint128 dailyCap);
    error ZeroAddress();
    error ZeroCap();

    event Authorized(address indexed user, address indexed agent, address token, uint128 dailyCap, address recipient);
    event Revoked(address indexed user);
    event Pulled(address indexed user, address indexed agent, uint256 amount, address recipient);

    struct Authorization {
        address agent;
        address token;
        address recipient;
        uint128 dailyCap;
        uint128 spentToday;
        uint64 day;
        bool active;
    }

    mapping(address user => Authorization) public authorizations;

    function authorize(address agent, address token, uint128 dailyCap, address recipient) external {
        if (agent == address(0) || token == address(0) || recipient == address(0)) revert ZeroAddress();
        if (dailyCap == 0) revert ZeroCap();
        authorizations[msg.sender] = Authorization({
            agent: agent,
            token: token,
            recipient: recipient,
            dailyCap: dailyCap,
            spentToday: 0,
            day: uint64(block.timestamp / 1 days),
            active: true
        });
        emit Authorized(msg.sender, agent, token, dailyCap, recipient);
    }

    function revoke() external {
        authorizations[msg.sender].active = false;
        emit Revoked(msg.sender);
    }

    function pull(address user, uint256 amount) external {
        Authorization storage auth = authorizations[user];
        if (!auth.active) revert NotAuthorized(user);
        if (msg.sender != auth.agent) revert NotAgent(user, msg.sender);

        uint64 today = uint64(block.timestamp / 1 days);
        if (today != auth.day) {
            auth.day = today;
            auth.spentToday = 0;
        }
        if (amount + auth.spentToday > auth.dailyCap) revert CapExceeded(user, amount, auth.dailyCap);
        auth.spentToday += uint128(amount);

        IERC20(auth.token).safeTransferFrom(user, auth.recipient, amount);
        emit Pulled(user, msg.sender, amount, auth.recipient);
    }
}
