/*
# Add secure phone-to-email lookup function

Drop the overly permissive lookup policy and replace with a function
that only returns the email for a specific phone number.
*/

-- Remove the overly broad policy
DROP POLICY IF EXISTS "lookup_email_by_phone" ON profiles;

-- Create a function that returns just the email for a given phone
CREATE OR REPLACE FUNCTION get_email_by_phone(p_phone text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM profiles WHERE phone = p_phone LIMIT 1;
$$;

-- Grant access to anon and authenticated
GRANT EXECUTE ON FUNCTION get_email_by_phone(text) TO anon, authenticated;
