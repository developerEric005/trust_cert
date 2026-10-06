# /backend (A core, B AI/verify)
Planned layout: `src/routes` (HTTP), `src/services` (hashing, merkle, chain, ai, verify), `src/db` (queries), `src/utils`.
- A: `services/hash.ts`, `merkle.ts`, `chain.ts`, `routes/batches.ts`, `routes/revoke.ts`, `routes/auth.ts`
- B: `services/ai.ts` (provider switch), `routes/verifyPhoto.ts`, `routes/verifyCheck.ts`, `db/` seed scripts
Specs: `../docs/API.md`, `../docs/HASHING.md`.
