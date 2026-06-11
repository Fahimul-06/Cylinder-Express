/*
# Allow phone-based email lookup for login

Add a policy so unauthenticated users can look up a profile's email by phone
number. Needed for the phone login flow to find the real email.
*/

CREATE POLICY "lookup_email_by_phone" ON profiles FOR SELECT
  TO anon, authenticated
  USING (phone IS NOT NULL);
