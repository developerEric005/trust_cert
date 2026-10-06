# Hashing spec (FROZEN). Identical in every codebase.
- Normalise each field: trim, collapse repeated whitespace to one space, lowercase, Unicode NFC.
- Order: `reg_no | student_name | award | class_of_award | graduation_year | serial_no | salt` joined with `|`.
- Leaf = SHA-256 of the UTF-8 string, `0x`-prefixed 64-hex (bytes32).
- Salt = 16 random bytes, hex, per record, stored in DB, never shown to employers.
- Merkle: `merkletreejs`, SHA-256, `sortPairs: true`, `hashLeaves: false`. Root = `0x` + 64 hex.
- Proof stored as JSON array of `0x` hex strings.
