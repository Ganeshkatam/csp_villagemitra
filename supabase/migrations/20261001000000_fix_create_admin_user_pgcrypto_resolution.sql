-- ==============================================================================
-- Migration: 20261001000000_fix_create_admin_user_pgcrypto_resolution
-- Resolves unqualified pgcrypto dependency resolution in public.create_admin_user.
-- Maintains strict search_path = public, pg_temp, while explicitly qualifying
-- extensions.gen_random_uuid(), extensions.crypt(), and extensions.gen_salt().
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_admin_user(
  new_email text,
  temp_password text,
  user_role text DEFAULT 'admin'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid := extensions.gen_random_uuid();
  v_clean_email text := lower(trim(new_email));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only verified administrators can create users.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_clean_email) THEN
    RAISE EXCEPTION 'A user with this email already exists.';
  END IF;

  IF length(temp_password) < 6 THEN
    RAISE EXCEPTION 'Temporary password must be at least 6 characters.';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    extensions.crypt(temp_password, extensions.gen_salt('bf'::text)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', user_role, 'must_change_password', true),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
    'email',
    v_clean_email,
    now(),
    now(),
    now()
  );

  IF user_role = 'admin' THEN
    INSERT INTO public.admin_users (user_id, email, role)
    VALUES (v_user_id, v_clean_email, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, role = 'admin';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_user_id,
    'email', v_clean_email
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_user(text, text, text) TO authenticated;
