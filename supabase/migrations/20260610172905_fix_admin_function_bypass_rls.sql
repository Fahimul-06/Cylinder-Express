/*
# Fix: is_current_user_admin must bypass RLS

SECURITY DEFINER alone doesn't bypass RLS on the tables it queries.
We need to SET row_security = off inside the function.
*/

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()),
    false
  );
$$;
