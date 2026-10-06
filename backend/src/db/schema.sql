-- TrustCert PostgreSQL Schema (FROZEN SPEC)

CREATE TABLE IF NOT EXISTS universities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cue_charter_ref TEXT,
  wallet_address TEXT UNIQUE,
  accredited BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  university_id INT REFERENCES universities(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL -- admin | registrar
);

CREATE TABLE IF NOT EXISTS batches (
  id SERIAL PRIMARY KEY,
  university_id INT REFERENCES universities(id),
  merkle_root TEXT NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  record_count INT,
  anchored_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id SERIAL PRIMARY KEY,
  batch_id INT REFERENCES batches(id),
  university_id INT REFERENCES universities(id),
  serial_no TEXT NOT NULL,
  reg_no TEXT NOT NULL,
  student_name TEXT NOT NULL,
  programme TEXT,
  award TEXT,
  class_of_award TEXT,
  graduation_year INT,
  salt TEXT NOT NULL,
  leaf_hash TEXT UNIQUE NOT NULL,
  merkle_proof JSONB NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_reason TEXT,
  revoked_tx TEXT,
  UNIQUE (university_id, serial_no)
);

CREATE TABLE IF NOT EXISTS verifications (
  id SERIAL PRIMARY KEY,
  record_id INT REFERENCES records(id),
  input_method TEXT,
  extracted_fields JSONB,
  result TEXT,
  mismatched_fields TEXT[],
  ai_risk_score NUMERIC,
  ai_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
