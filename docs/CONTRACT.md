# Smart contract interface (FROZEN). Solidity ^0.8.20, OpenZeppelin Ownable, Polygon Amoy.
```solidity
function approveUniversity(address uni) external onlyOwner;
function isApproved(address uni) external view returns (bool);
function registerRoot(bytes32 root, uint32 count) external returns (uint256 batchId); // approved wallets only
function rootIssuer(bytes32 root) external view returns (address);                 // zero address if unknown
function batches(uint256 batchId) external view returns (bytes32 root, address issuer, uint32 count, uint64 timestamp);
function revoke(bytes32 leaf) external;   // any approved wallet; backend ensures a registrar only revokes own records
function isRevoked(bytes32 leaf) external view returns (bool);
event RootRegistered(uint256 indexed batchId, bytes32 root, address indexed issuer, uint32 count);
event Revoked(bytes32 indexed leaf, address indexed by);
```
