// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustCert
 * @notice Anchors university certificate Merkle roots and manages certificate revocations.
 * @dev Spec: ABF 2026 Hackathon (Polygon Amoy).
 *      batchId numbering starts at 1.
 */
contract TrustCert is Ownable {
    struct Batch {
        bytes32 root;
        address issuer;
        uint32 count;
        uint64 timestamp;
    }

    /// @dev batchId counter; starts at 1
    uint256 private _nextBatchId = 1;

    /// @notice Approved university wallets
    mapping(address => bool) public isApproved;

    /// @notice Maps Merkle root to issuer wallet address (returns address(0) if unknown)
    mapping(bytes32 => address) public rootIssuer;

    /// @notice Maps batchId to batch metadata
    mapping(uint256 => Batch) private _batches;

    /// @notice Maps leaf hash to revocation status
    mapping(bytes32 => bool) public isRevoked;

    // Events
    event RootRegistered(uint256 indexed batchId, bytes32 root, address indexed issuer, uint32 count);
    event Revoked(bytes32 indexed leaf, address indexed by);
    event UniversityApproved(address indexed uni);

    modifier onlyApproved() {
        require(isApproved[msg.sender], "Not approved university");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Approves a university wallet address to register roots and revoke records.
     * @param uni Wallet address of the university.
     */
    function approveUniversity(address uni) external onlyOwner {
        require(uni != address(0), "Zero address");
        isApproved[uni] = true;
        emit UniversityApproved(uni);
    }

    /**
     * @notice Registers a new Merkle root for a batch of certificates.
     * @param root The bytes32 Merkle root of the batch.
     * @param count Number of certificate records in the batch.
     * @return batchId Unique identifier of the registered batch (starts at 1).
     */
    function registerRoot(bytes32 root, uint32 count) external onlyApproved returns (uint256 batchId) {
        require(root != bytes32(0), "Zero root");
        require(count > 0, "Zero count");
        require(rootIssuer[root] == address(0), "Duplicate root");

        batchId = _nextBatchId++;
        rootIssuer[root] = msg.sender;
        _batches[batchId] = Batch({
            root: root,
            issuer: msg.sender,
            count: count,
            timestamp: uint64(block.timestamp)
        });

        emit RootRegistered(batchId, root, msg.sender, count);
    }

    /**
     * @notice Retrieves batch details for a given batchId.
     * @param batchId The batch ID.
     */
    function batches(uint256 batchId) external view returns (bytes32 root, address issuer, uint32 count, uint64 timestamp) {
        Batch storage b = _batches[batchId];
        return (b.root, b.issuer, b.count, b.timestamp);
    }

    /**
     * @notice Revokes a specific certificate record by its leaf hash.
     * @dev Any approved university wallet can call this; backend enforces that registrars only revoke their own records.
     * @param leaf The bytes32 leaf hash of the certificate.
     */
    function revoke(bytes32 leaf) external onlyApproved {
        require(leaf != bytes32(0), "Zero leaf");
        isRevoked[leaf] = true;
        emit Revoked(leaf, msg.sender);
    }
}
