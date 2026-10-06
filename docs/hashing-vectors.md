# Hashing Test Vectors (TrustCert FROZEN Spec)

This document provides exact test vectors for normalisation, leaf computation, and Merkle tree generation for Person A (Backend), Person B (AI extraction / validation), and Person C (Frontend).

---

## 1. Normalisation Rules
1. Trim leading and trailing whitespace.
2. Collapse repeated whitespace within the string to a single space (`" "`).
3. Lowercase all characters.
4. Normalize to Unicode NFC form.

---

## 2. Field Ordering & Join Format
Fields are joined with the pipe character (`|`) without surrounding spaces:
```
reg_no|student_name|award|class_of_award|graduation_year|serial_no|salt
```

---

## 3. Test Vector 1

### Input Data
- `reg_no`: `"  P15/12345/2020  "`
- `student_name`: `"John  Mwangi  Kamau"`
- `award`: `"Bachelor of Science in Computer Science"`
- `class_of_award`: `"First Class Honours"`
- `graduation_year`: `"2024"`
- `serial_no`: `"UON-2024-00101"`
- `salt`: `"a1b2c3d4e5f67890123456789abcdef0"` (16 bytes hex, 32 characters)

### Normalised Joined String
```text
p15/12345/2020|john mwangi kamau|bachelor of science in computer science|first class honours|2024|uon-2024-00101|a1b2c3d4e5f67890123456789abcdef0
```

### UTF-8 SHA-256 Leaf Hash (`0x` + 64 hex characters)
```text
0x07701c164194d946c832f39dfdfc16235d9135ef1b43a9f5262597f07dd23eb7
```

---

## 4. Test Vector 2

### Input Data
- `reg_no`: `"ENG/0987/2019"`
- `student_name`: `"Amina   Fatuma Hassan "`
- `award`: `"Bachelor of Science in Civil Engineering"`
- `class_of_award`: `"Second Class Honours (Upper Division)"`
- `graduation_year`: `2024`
- `serial_no`: `"UON-2024-00102"`
- `salt`: `"f0e1d2c3b4a5968778695a4b3c2d1e0f"`

### Normalised Joined String
```text
eng/0987/2019|amina fatuma hassan|bachelor of science in civil engineering|second class honours (upper division)|2024|uon-2024-00102|f0e1d2c3b4a5968778695a4b3c2d1e0f
```

### UTF-8 SHA-256 Leaf Hash (`0x` + 64 hex characters)
```text
0xeb656e42b1608f88824d3065cb604470dd90284a87682a88cf9dd1fa6ad98c21
```

---

## 5. 2-Leaf Merkle Tree

When constructing a tree with `[Leaf1, Leaf2]` using `merkletreejs` with `sortPairs: true`, `hashLeaves: false`, and `SHA-256`:

### Sorted Pair Order
1. `0x07701c164194d946c832f39dfdfc16235d9135ef1b43a9f5262597f07dd23eb7` (Leaf 1)
2. `0xeb656e42b1608f88824d3065cb604470dd90284a87682a88cf9dd1fa6ad98c21` (Leaf 2)

### Merkle Root
```text
0x87cc6d0697f4282bbb67299edb828c4cb4891e0644b25fd26c9effa40e9a3848
```

### Merkle Proof for Leaf 1
```json
[
  "0xeb656e42b1608f88824d3065cb604470dd90284a87682a88cf9dd1fa6ad98c21"
]
```

### Merkle Proof for Leaf 2
```json
[
  "0x07701c164194d946c832f39dfdfc16235d9135ef1b43a9f5262597f07dd23eb7"
]
```
