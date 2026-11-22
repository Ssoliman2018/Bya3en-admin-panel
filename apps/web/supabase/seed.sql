-- Bayya3een local demo admins (recreated on every `supabase db reset`)
-- Password for both: Admin123!
--   darkdiamond.dr@gmail.com
--   sarah@mersal.com.sa

create extension if not exists "pgcrypto";

do $$
declare
  encrypted text := crypt('Admin123!', gen_salt('bf'));
  u1 uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  u2 uuid := 'b1ffcd00-0d1c-4ef8-aa7e-7cc0ce491b22';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    (
      '00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
      'darkdiamond.dr@gmail.com', encrypted, now(),
      '{"provider":"email","providers":["email"]}', '{"name":"Admin بياعين"}',
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
      'sarah@mersal.com.sa', encrypted, now(),
      '{"provider":"email","providers":["email"]}', '{"name":"سارة"}',
      now(), now(), '', '', '', ''
    )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values
    (
      u1, u1,
      format('{"sub":"%s","email":"darkdiamond.dr@gmail.com"}', u1)::jsonb,
      'email', u1::text, now(), now(), now()
    ),
    (
      u2, u2,
      format('{"sub":"%s","email":"sarah@mersal.com.sa"}', u2)::jsonb,
      'email', u2::text, now(), now(), now()
    )
  on conflict do nothing;
end $$;
