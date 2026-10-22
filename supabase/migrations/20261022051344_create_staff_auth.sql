-- Staff data belongs to one gym. Members/products/payments are out of scope.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  role text not null check (role in ('admin', 'sub_admin')),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  credentials_reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;
grant select on public.staff to authenticated;
grant select, insert, update, delete on public.staff to service_role;

-- This helper checks the caller's own session only. Never accepts a user ID.
-- Kept outside the exposed API schema; required because clients cannot read auth.sessions.
create function private.staff_session_valid() returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s
    where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id'
  );
$$;
revoke all on function private.staff_session_valid() from public, anon;
grant execute on function private.staff_session_valid() to authenticated;

create policy staff_read_self on public.staff for select to authenticated
using (id = (select auth.uid()) and is_active and (select private.staff_session_valid()));

create function private.staff_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.staff_updated_at() from public, anon, authenticated;
create trigger staff_updated_at before update on public.staff
for each row execute function private.staff_updated_at();

-- Only privileged staff mutations can reach this trigger (no client DML grants).
-- Deleting sessions also makes the self-read policy reject old JWTs immediately.
create function private.staff_revoke_reset_sessions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.credentials_reset_at is distinct from old.credentials_reset_at then
    delete from auth.sessions where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.staff_revoke_reset_sessions() from public, anon, authenticated;
create trigger staff_revoke_reset_sessions after update on public.staff
for each row execute function private.staff_revoke_reset_sessions();
