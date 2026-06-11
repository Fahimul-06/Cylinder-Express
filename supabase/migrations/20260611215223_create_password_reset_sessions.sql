-- Short-lived tokens issued after OTP verification for password reset
CREATE TABLE IF NOT EXISTS password_reset_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reset_sessions_phone ON password_reset_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_reset_sessions_token ON password_reset_sessions(token);
