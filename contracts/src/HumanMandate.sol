// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IHumanRegistry} from "./interfaces/IHumanRegistry.sol";

/// @title HumanMandate
/// @notice A spending mandate granted to a *person*, not to an address.
///
///         Cards, bank mandates and token allowances all bind authority to a credential or an
///         account, so the party you cut off returns under a new one. Here the payer authorises
///         an anonymous human — identified by World's AgentBook — and every rule is enforced
///         against that human: the window cap is theirs, the revocation is theirs. An address
///         never named in the mandate can spend if its human was authorised; a fresh address
///         with no human behind it cannot.
///
///         Custody never moves. The contract holds an allowance, not funds, and can only ever
///         send to the recipient fixed at authorisation time. No owner, no pause, no proxy.
///
///         Privacy: the raw World ID nullifier never appears in storage, calldata or logs.
///         The payer authorises a `humanRef` — `keccak256(abi.encode(chainid, thisContract,
///         humanId))` — computed off-chain. The same person therefore has a different
///         reference in every deployment, so nothing here becomes a cross-context handle.
contract HumanMandate is EIP712 {
    using SafeERC20 for IERC20;

    error NotAuthorized(address payer, bytes32 mandateId);
    error AlreadyActive(address payer, bytes32 mandateId);
    error NotHumanBacked(address caller);
    error WrongHuman(bytes32 callerRef, bytes32 authorizedRef);
    error CapExceeded(address payer, uint256 requested, uint128 windowCap);
    error PerTxCapExceeded(uint256 requested, uint128 perTxCap);
    error ZeroAmount();
    error ZeroAddress();
    error ZeroCap();
    error ZeroHuman();
    error NotLowering();
    error LivenessRequired();
    error LivenessExpired();
    error LivenessAlreadyUsed();

    event Authorized(
        address indexed payer,
        bytes32 indexed mandateId,
        bytes32 humanRef,
        address token,
        uint128 windowCap,
        uint128 perTxCap,
        address recipient
    );
    event Revoked(address indexed payer, bytes32 indexed mandateId);
    event Pulled(
        address indexed payer, bytes32 indexed mandateId, address agent, uint256 amount, address recipient
    );
    event LimitsRaised(address indexed payer, bytes32 indexed mandateId, uint128 windowCap, address recipient);
    event CapLowered(address indexed payer, bytes32 indexed mandateId, uint128 windowCap);

    bytes32 private constant STEPUP_TYPEHASH = keccak256(
        "StepUp(address account,bytes32 mandateId,uint128 newCap,address newRecipient,uint256 deadline)"
    );

    /// @notice 24 hours measured from the first spend of a window, not a UTC calendar bucket —
    ///         a calendar bucket lets two full caps clear seconds apart across midnight.
    uint64 public constant WINDOW = 1 days;

    struct Mandate {
        bytes32 humanRef;
        address token;
        address recipient;
        uint128 windowCap;
        uint128 perTxCap;
        uint128 spentInWindow;
        uint64 windowStart;
        bool active;
    }

    IHumanRegistry public immutable registry;
    /// @notice Signs only after a fresh liveness check. Holds no funds and no other authority.
    address public immutable livenessAttestor;

    /// @notice One payer may run many mandates — one per agent, per budget, per payee — the way
    ///         a company account issues many cards. A single slot could not express that.
    mapping(address payer => mapping(bytes32 mandateId => Mandate)) public mandates;
    mapping(bytes32 digest => bool) public usedStepUp;

    constructor(IHumanRegistry registry_, address livenessAttestor_) EIP712("HumanMandate", "2") {
        if (address(registry_) == address(0) || livenessAttestor_ == address(0)) revert ZeroAddress();
        registry = registry_;
        livenessAttestor = livenessAttestor_;
    }

    /// @notice The reference a payer must authorise for a given human. Computed off-chain so the
    ///         raw nullifier never reaches the chain; exposed here so callers can check their work.
    function humanRef(uint256 humanId) public view returns (bytes32) {
        if (humanId == 0) return bytes32(0);
        return keccak256(abi.encode(block.chainid, address(this), humanId));
    }

    /// @notice The caller's reference, resolved through the registry.
    ///         Fails closed: if the registry is unreachable this returns 0 and every pull
    ///         reverts, which for a spending contract is the safe direction.
    function refOf(address account) public view returns (bytes32) {
        try registry.humanOf(account) returns (uint256 humanId) {
            return humanRef(humanId);
        } catch {
            return bytes32(0);
        }
    }

    /// @notice Open a mandate. Refuses to overwrite a live one — re-arming an active mandate
    ///         would be an ungated `raiseLimits`, and the whole point of the step-up gate is
    ///         that widening authority costs a fresh liveness proof. Revoke first.
    function authorize(
        bytes32 mandateId,
        bytes32 authorizedHumanRef,
        address token,
        uint128 windowCap,
        uint128 perTxCap,
        address recipient
    ) external {
        if (authorizedHumanRef == bytes32(0)) revert ZeroHuman();
        if (token == address(0) || recipient == address(0)) revert ZeroAddress();
        if (windowCap == 0 || perTxCap == 0) revert ZeroCap();

        Mandate storage mandate = mandates[msg.sender][mandateId];
        if (mandate.active) revert AlreadyActive(msg.sender, mandateId);

        mandate.humanRef = authorizedHumanRef;
        mandate.token = token;
        mandate.recipient = recipient;
        mandate.windowCap = windowCap;
        mandate.perTxCap = perTxCap;
        mandate.spentInWindow = 0;
        mandate.windowStart = uint64(block.timestamp);
        mandate.active = true;

        emit Authorized(msg.sender, mandateId, authorizedHumanRef, token, windowCap, perTxCap, recipient);
    }

    /// @notice Cut the human off. Every agent they operate, present and future, loses this
    ///         mandate in the same transaction.
    function revoke(bytes32 mandateId) external {
        Mandate storage mandate = mandates[msg.sender][mandateId];
        if (!mandate.active) revert NotAuthorized(msg.sender, mandateId);
        mandate.active = false;
        emit Revoked(msg.sender, mandateId);
    }

    function stepUpDigest(
        address account,
        bytes32 mandateId,
        uint128 newCap,
        address newRecipient,
        uint256 deadline
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(STEPUP_TYPEHASH, account, mandateId, newCap, newRecipient, deadline))
        );
    }

    /// @notice Widen a mandate — a higher cap or a different payee. Requires a fresh liveness
    ///         attestation bound to this exact account, mandate, amount and payee, so a
    ///         compromised client cannot have a genuine face sign off on a different payee
    ///         (PSD2 RTS Art. 5 dynamic linking, applied on-chain).
    function raiseLimits(
        bytes32 mandateId,
        uint128 newCap,
        address newRecipient,
        uint256 deadline,
        bytes calldata livenessProof
    ) external {
        Mandate storage mandate = mandates[msg.sender][mandateId];
        if (!mandate.active) revert NotAuthorized(msg.sender, mandateId);
        if (newCap == 0) revert ZeroCap();
        if (newRecipient == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert LivenessExpired();

        bytes32 digest = stepUpDigest(msg.sender, mandateId, newCap, newRecipient, deadline);
        if (usedStepUp[digest]) revert LivenessAlreadyUsed();
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, livenessProof);
        if (err != ECDSA.RecoverError.NoError || signer != livenessAttestor) revert LivenessRequired();
        usedStepUp[digest] = true;

        mandate.windowCap = newCap;
        mandate.recipient = newRecipient;
        emit LimitsRaised(msg.sender, mandateId, newCap, newRecipient);
    }

    /// @notice Tightening your own leash is never gated.
    function lowerCap(bytes32 mandateId, uint128 newCap) external {
        Mandate storage mandate = mandates[msg.sender][mandateId];
        if (!mandate.active) revert NotAuthorized(msg.sender, mandateId);
        if (newCap == 0) revert ZeroCap();
        if (newCap >= mandate.windowCap) revert NotLowering();
        mandate.windowCap = newCap;
        emit CapLowered(msg.sender, mandateId, newCap);
    }

    /// @notice Called by an agent. The caller's *human* — not the caller's address — must match
    ///         the mandate, and the human's rolling budget must cover the amount.
    function pull(address payer, bytes32 mandateId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        Mandate storage mandate = mandates[payer][mandateId];
        if (!mandate.active) revert NotAuthorized(payer, mandateId);

        bytes32 callerRef = refOf(msg.sender);
        if (callerRef == bytes32(0)) revert NotHumanBacked(msg.sender);
        if (callerRef != mandate.humanRef) revert WrongHuman(callerRef, mandate.humanRef);

        if (amount > mandate.perTxCap) revert PerTxCapExceeded(amount, mandate.perTxCap);

        if (block.timestamp >= mandate.windowStart + WINDOW) {
            mandate.windowStart = uint64(block.timestamp);
            mandate.spentInWindow = 0;
        }
        if (amount + mandate.spentInWindow > mandate.windowCap) {
            revert CapExceeded(payer, amount, mandate.windowCap);
        }
        mandate.spentInWindow += uint128(amount);

        IERC20(mandate.token).safeTransferFrom(payer, mandate.recipient, amount);
        emit Pulled(payer, mandateId, msg.sender, amount, mandate.recipient);
    }
}
