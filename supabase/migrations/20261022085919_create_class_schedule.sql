-- Group class types, weekly series and materialized sessions for one gym.
-- Sessions are kept up to one year ahead so instructor overlaps can be enforced by a constraint.
create extension if not exists btree_gist with schema extensions;

alter table public.staff add column is_instructor boolean not null default false;

create table public.class_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 30 and name = btrim(name)),
  default_capacity integer not null check (default_capacity between 1 and 100),
  default_duration_minutes integer not null
    check (default_duration_minutes between 10 and 240 and default_duration_minutes % 5 = 0),
  color text not null
    check (color in ('orange', 'red', 'pink', 'violet', 'blue', 'teal', 'green', 'yellow')),
  is_active boolean not null default true,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index class_types_active_name on public.class_types (lower(name)) where is_active;

create table public.class_series (
  id uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references public.class_types(id) on delete restrict,
  instructor_id uuid references public.staff(id) on delete set null,
  weekdays smallint[] not null
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  start_time time not null
    check (date_part('second', start_time) = 0 and date_part('minute', start_time)::int % 5 = 0),
  duration_minutes integer not null
    check (duration_minutes between 10 and 240 and duration_minutes % 5 = 0),
  capacity integer not null check (capacity between 1 and 100),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  cancelled_from date,
  generated_until date,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_part('epoch', start_time) + duration_minutes * 60 <= 86400)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.class_series(id) on delete cascade,
  occurrence_date date,
  class_type_id uuid not null references public.class_types(id) on delete restrict,
  instructor_id uuid references public.staff(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 100),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'deleted')),
  is_modified boolean not null default false,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at - starts_at between interval '10 minutes' and interval '240 minutes'),
  -- A class may end at midnight but never continues into the next day.
  check (((ends_at - interval '1 microsecond') at time zone 'Asia/Seoul')::date
    = (starts_at at time zone 'Asia/Seoul')::date),
  check ((series_id is null) = (occurrence_date is null)),
  check (status <> 'deleted' or series_id is not null),
  unique (series_id, occurrence_date),
  constraint class_sessions_no_instructor_overlap exclude using gist (
    instructor_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'scheduled' and instructor_id is not null)
);
create index class_sessions_starts_at on public.class_sessions (starts_at);
create index class_sessions_instructor on public.class_sessions (instructor_id, starts_at);
create index class_series_instructor on public.class_series (instructor_id);

-- Staff may read schedule data; every change goes through the service-role functions below.
create function private.class_reader() returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and not must_change_password
  );
$$;
revoke all on function private.class_reader() from public, anon;
grant execute on function private.class_reader() to authenticated;

alter table public.class_types enable row level security;
alter table public.class_series enable row level security;
alter table public.class_sessions enable row level security;
revoke all on public.class_types, public.class_series, public.class_sessions from anon, authenticated;
grant select on public.class_types, public.class_series, public.class_sessions to authenticated;
grant select, insert, update, delete
  on public.class_types, public.class_series, public.class_sessions to service_role;
create policy class_types_read on public.class_types for select to authenticated
using ((select private.class_reader()));
create policy class_series_read on public.class_series for select to authenticated
using ((select private.class_reader()));
create policy class_sessions_read on public.class_sessions for select to authenticated
using ((select private.class_reader()));

create trigger class_types_updated_at before update on public.class_types
for each row execute function private.staff_updated_at();
create trigger class_series_updated_at before update on public.class_series
for each row execute function private.staff_updated_at();
create trigger class_sessions_updated_at before update on public.class_sessions
for each row execute function private.staff_updated_at();

-- Helpers. All schedule writes serialize on one transaction lock (single gym, low volume).
create function private.class_lock() returns void
language sql volatile set search_path = '' as $$
  select pg_advisory_xact_lock(724050101);
$$;
create function private.class_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;
create function private.class_horizon() returns date
language sql stable set search_path = '' as $$
  select (private.class_today() + interval '1 year')::date;
$$;
create function private.class_at(p_date date, p_time time) returns timestamptz
language sql immutable set search_path = '' as $$
  select (p_date + p_time) at time zone 'Asia/Seoul';
$$;
create function private.class_result(p_code text, p_conflicts jsonb default null) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object('ok', false, 'code', p_code, 'conflicts', p_conflicts));
$$;

create function private.class_type_usable(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.class_types where id = p_id and is_active);
$$;
create function private.class_instructor_usable(p_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.staff where id = p_id and is_active and is_instructor);
$$;

-- Existing scheduled sessions of one instructor that overlap any requested range.
create function private.class_conflicts(
  p_instructor uuid,
  p_ranges tstzrange[],
  p_exclude_ids uuid[] default '{}',
  p_exclude_series uuid default null,
  p_exclude_from date default null
) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'starts_at', c.starts_at,
      'ends_at', c.ends_at,
      'class_name', c.name
    ) order by c.starts_at), '[]'::jsonb)
  from (
    select distinct s.id, s.starts_at, s.ends_at, t.name
    from public.class_sessions s
    join public.class_types t on t.id = s.class_type_id
    join unnest(p_ranges) r(range) on tstzrange(s.starts_at, s.ends_at, '[)') && r.range
    where p_instructor is not null
      and s.instructor_id = p_instructor
      and s.status = 'scheduled'
      and s.id <> all(p_exclude_ids)
      and not (p_exclude_series is not null and s.series_id = p_exclude_series
        and s.occurrence_date >= p_exclude_from)
  ) c;
$$;

-- Rule dates in [from, to] that start in the future.
create function private.class_rule_dates(
  p_weekdays smallint[], p_start_time time, p_from date, p_to date
) returns setof date
language sql stable set search_path = '' as $$
  select d::date
  from generate_series(p_from, p_to, interval '1 day') d
  where extract(isodow from d)::smallint = any(p_weekdays)
    and private.class_at(d::date, p_start_time) > now();
$$;

create function private.class_fill_series(p_series public.class_series, p_from date, p_to date)
returns void
language sql volatile set search_path = '' as $$
  insert into public.class_sessions (
    series_id, occurrence_date, class_type_id, instructor_id, starts_at, ends_at,
    capacity, status, created_by
  )
  select p_series.id, d, p_series.class_type_id, p_series.instructor_id,
    private.class_at(d, p_series.start_time),
    private.class_at(d, p_series.start_time) + make_interval(mins => p_series.duration_minutes),
    p_series.capacity,
    case when p_series.cancelled_from is not null and d >= p_series.cancelled_from
      then 'cancelled' else 'scheduled' end,
    p_series.created_by
  from private.class_rule_dates(p_series.weekdays, p_series.start_time, p_from, p_to) d
  on conflict (series_id, occurrence_date) do nothing;
$$;

-- Keeps every series materialized up to today + 1 year. Caller must hold the lock.
create function private.class_extend() returns void
language plpgsql volatile set search_path = '' as $$
declare
  v_horizon date := private.class_horizon();
  v_series public.class_series;
  v_to date;
begin
  for v_series in
    select * from public.class_series
    where coalesce(generated_until, start_date - 1) < least(coalesce(end_date, v_horizon), v_horizon)
  loop
    v_to := least(coalesce(v_series.end_date, v_horizon), v_horizon);
    perform private.class_fill_series(
      v_series, greatest(v_series.start_date, coalesce(v_series.generated_until + 1, v_series.start_date)), v_to);
    update public.class_series set generated_until = v_to where id = v_series.id;
  end loop;
end;
$$;

create function public.class_extend_series() returns void
language plpgsql volatile set search_path = '' as $$
begin
  perform private.class_lock();
  perform private.class_extend();
end;
$$;

create function public.class_create(
  p_actor uuid,
  p_class_type_id uuid,
  p_instructor_id uuid,
  p_capacity integer,
  p_duration_minutes integer,
  p_start_time time,
  p_date date,
  p_weekdays smallint[],
  p_end_date date
) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_today date;
  v_horizon date;
  v_to date;
  v_ranges tstzrange[];
  v_conflicts jsonb;
  v_series public.class_series;
  v_id uuid;
begin
  perform private.class_lock();
  perform private.class_extend();
  v_today := private.class_today();
  v_horizon := private.class_horizon();
  if not private.class_type_usable(p_class_type_id) then
    return private.class_result('type_unavailable');
  end if;
  if not private.class_instructor_usable(p_instructor_id) then
    return private.class_result('instructor_unavailable');
  end if;
  if p_date is null or p_date < v_today or p_date > v_horizon
    or (p_end_date is not null and p_end_date < p_date) then
    return private.class_result('out_of_range');
  end if;

  if p_weekdays is null then
    if private.class_at(p_date, p_start_time) <= now() then
      return private.class_result('past');
    end if;
    v_ranges := array[tstzrange(private.class_at(p_date, p_start_time),
      private.class_at(p_date, p_start_time) + make_interval(mins => p_duration_minutes), '[)')];
  else
    v_to := least(coalesce(p_end_date, v_horizon), v_horizon);
    select array_agg(tstzrange(private.class_at(d, p_start_time),
        private.class_at(d, p_start_time) + make_interval(mins => p_duration_minutes), '[)'))
      into v_ranges
      from private.class_rule_dates(p_weekdays, p_start_time, p_date, v_to) d;
    if v_ranges is null then
      return private.class_result('no_dates');
    end if;
  end if;

  v_conflicts := private.class_conflicts(p_instructor_id, v_ranges);
  if jsonb_array_length(v_conflicts) > 0 then
    return private.class_result('conflict', v_conflicts);
  end if;

  if p_weekdays is null then
    insert into public.class_sessions (
      class_type_id, instructor_id, starts_at, ends_at, capacity, created_by)
    values (p_class_type_id, p_instructor_id, lower(v_ranges[1]), upper(v_ranges[1]),
      p_capacity, p_actor)
    returning id into v_id;
  else
    insert into public.class_series (
      class_type_id, instructor_id, weekdays, start_time, duration_minutes, capacity,
      start_date, end_date, generated_until, created_by)
    values (p_class_type_id, p_instructor_id, p_weekdays, p_start_time, p_duration_minutes,
      p_capacity, p_date, p_end_date, v_to, p_actor)
    returning * into v_series;
    perform private.class_fill_series(v_series, p_date, v_to);
    v_id := v_series.id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Loads a session that may still be changed. Caller must hold the lock.
create function private.class_editable(p_session_id uuid) returns public.class_sessions
language sql stable set search_path = '' as $$
  select * from public.class_sessions where id = p_session_id and status <> 'deleted';
$$;

create function public.class_update(
  p_actor uuid,
  p_session_id uuid,
  p_scope text,
  p_class_type_id uuid,
  p_instructor_id uuid,
  p_capacity integer,
  p_duration_minutes integer,
  p_start_time time,
  p_date date,
  p_weekdays smallint[],
  p_end_date date
) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_session public.class_sessions;
  v_old public.class_series;
  v_new public.class_series;
  v_today date;
  v_horizon date;
  v_split date;
  v_to date;
  v_starts timestamptz;
  v_ranges tstzrange[];
  v_conflicts jsonb;
  v_kept_dates date[];
  v_kept_status text[];
begin
  perform private.class_lock();
  perform private.class_extend();
  v_today := private.class_today();
  v_horizon := private.class_horizon();
  v_session := private.class_editable(p_session_id);
  if v_session.id is null then
    return private.class_result('not_found');
  end if;
  if v_session.starts_at <= now() then
    return private.class_result('past');
  end if;
  if p_class_type_id <> v_session.class_type_id and not private.class_type_usable(p_class_type_id) then
    return private.class_result('type_unavailable');
  end if;
  if p_instructor_id is not null and not private.class_instructor_usable(p_instructor_id) then
    return private.class_result('instructor_unavailable');
  end if;

  if p_scope = 'one' or v_session.series_id is null then
    if p_date is null or p_date < v_today or p_date > v_horizon then
      return private.class_result('out_of_range');
    end if;
    v_starts := private.class_at(p_date, p_start_time);
    if v_starts <= now() then
      return private.class_result('past');
    end if;
    v_ranges := array[tstzrange(v_starts, v_starts + make_interval(mins => p_duration_minutes), '[)')];
    if v_session.status = 'scheduled' then
      v_conflicts := private.class_conflicts(p_instructor_id, v_ranges, array[v_session.id]);
      if jsonb_array_length(v_conflicts) > 0 then
        return private.class_result('conflict', v_conflicts);
      end if;
    end if;
    update public.class_sessions
      set class_type_id = p_class_type_id, instructor_id = p_instructor_id,
        starts_at = lower(v_ranges[1]), ends_at = upper(v_ranges[1]), capacity = p_capacity,
        is_modified = series_id is not null
      where id = v_session.id;
    return jsonb_build_object('ok', true, 'id', v_session.id);
  end if;

  if p_scope <> 'following' or p_weekdays is null then
    return private.class_result('invalid');
  end if;
  select * into v_old from public.class_series where id = v_session.series_id;
  v_split := v_session.occurrence_date;
  if v_split < v_today or (p_end_date is not null and p_end_date < v_split) then
    return private.class_result('out_of_range');
  end if;
  v_to := least(coalesce(p_end_date, v_horizon), v_horizon);

  -- Cancelled/deleted dates in the replaced range carry over to the same new dates.
  select coalesce(array_agg(occurrence_date), '{}'), coalesce(array_agg(status), '{}')
    into v_kept_dates, v_kept_status
    from public.class_sessions
    where series_id = v_old.id and occurrence_date >= v_split and status <> 'scheduled';

  if not exists (select 1 from private.class_rule_dates(p_weekdays, p_start_time, v_split, v_to)) then
    return private.class_result('no_dates');
  end if;
  select array_agg(tstzrange(private.class_at(d, p_start_time),
      private.class_at(d, p_start_time) + make_interval(mins => p_duration_minutes), '[)'))
    into v_ranges
    from private.class_rule_dates(p_weekdays, p_start_time, v_split, v_to) d
    where d <> all(v_kept_dates)
      and not (v_old.cancelled_from is not null and d >= v_old.cancelled_from);
  v_conflicts := private.class_conflicts(
    p_instructor_id, coalesce(v_ranges, '{}'), '{}', v_old.id, v_split);
  if jsonb_array_length(v_conflicts) > 0 then
    return private.class_result('conflict', v_conflicts);
  end if;

  delete from public.class_sessions
    where series_id = v_old.id and occurrence_date >= v_split and starts_at > now();
  insert into public.class_series (
    class_type_id, instructor_id, weekdays, start_time, duration_minutes, capacity,
    start_date, end_date, cancelled_from, generated_until, created_by)
  values (p_class_type_id, p_instructor_id, p_weekdays, p_start_time, p_duration_minutes,
    p_capacity, v_split, p_end_date,
    case when v_old.cancelled_from is null then null else greatest(v_old.cancelled_from, v_split) end,
    v_to, p_actor)
  returning * into v_new;
  perform private.class_fill_series(v_new, v_split, v_to);
  update public.class_sessions s set status = k.status
    from unnest(v_kept_dates, v_kept_status) k(occurrence_date, status)
    where s.series_id = v_new.id and s.occurrence_date = k.occurrence_date;

  if v_old.start_date >= v_split then
    delete from public.class_series where id = v_old.id;
  else
    update public.class_series
      set end_date = v_split - 1,
        generated_until = least(generated_until, v_split - 1),
        cancelled_from = case when cancelled_from >= v_split then null else cancelled_from end
      where id = v_old.id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_new.id);
end;
$$;

create function public.class_set_status(
  p_actor uuid,
  p_session_id uuid,
  p_scope text,
  p_status text
) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_session public.class_sessions;
  v_series public.class_series;
  v_ranges tstzrange[];
  v_conflicts jsonb;
begin
  perform private.class_lock();
  perform private.class_extend();
  if p_status not in ('scheduled', 'cancelled') then
    return private.class_result('invalid');
  end if;
  v_session := private.class_editable(p_session_id);
  if v_session.id is null then
    return private.class_result('not_found');
  end if;
  if v_session.starts_at <= now() then
    return private.class_result('past');
  end if;

  if p_scope = 'one' or v_session.series_id is null then
    if p_status = 'scheduled' and v_session.status = 'cancelled' then
      v_conflicts := private.class_conflicts(v_session.instructor_id,
        array[tstzrange(v_session.starts_at, v_session.ends_at, '[)')], array[v_session.id]);
      if jsonb_array_length(v_conflicts) > 0 then
        return private.class_result('conflict', v_conflicts);
      end if;
    end if;
    update public.class_sessions set status = p_status where id = v_session.id;
    return jsonb_build_object('ok', true, 'id', v_session.id);
  end if;
  if p_scope <> 'following' then
    return private.class_result('invalid');
  end if;

  select * into v_series from public.class_series where id = v_session.series_id;
  if p_status = 'cancelled' then
    update public.class_sessions set status = 'cancelled'
      where series_id = v_series.id and occurrence_date >= v_session.occurrence_date
        and status = 'scheduled' and starts_at > now();
    update public.class_series
      set cancelled_from = least(coalesce(cancelled_from, v_session.occurrence_date), v_session.occurrence_date)
      where id = v_series.id;
  else
    select array_agg(tstzrange(starts_at, ends_at, '[)')) into v_ranges
      from public.class_sessions
      where series_id = v_series.id and occurrence_date >= v_session.occurrence_date
        and status = 'cancelled' and starts_at > now() and instructor_id is not null;
    v_conflicts := private.class_conflicts(v_series.instructor_id, coalesce(v_ranges, '{}'));
    if jsonb_array_length(v_conflicts) > 0 then
      return private.class_result('conflict', v_conflicts);
    end if;
    -- Individually reassigned instructors are checked by the exclusion constraint.
    update public.class_sessions set status = 'scheduled'
      where series_id = v_series.id and occurrence_date >= v_session.occurrence_date
        and status = 'cancelled' and starts_at > now();
    update public.class_series set cancelled_from = null where id = v_series.id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_session.id);
end;
$$;

create function public.class_delete(p_actor uuid, p_session_id uuid, p_scope text) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_session public.class_sessions;
  v_series public.class_series;
begin
  perform private.class_lock();
  perform private.class_extend();
  v_session := private.class_editable(p_session_id);
  if v_session.id is null then
    return private.class_result('not_found');
  end if;
  if v_session.starts_at <= now() then
    return private.class_result('past');
  end if;
  if v_session.series_id is null then
    delete from public.class_sessions where id = v_session.id;
  elsif p_scope = 'one' then
    update public.class_sessions set status = 'deleted' where id = v_session.id;
  elsif p_scope = 'following' then
    select * into v_series from public.class_series where id = v_session.series_id;
    delete from public.class_sessions
      where series_id = v_series.id and occurrence_date >= v_session.occurrence_date
        and starts_at > now();
    if v_series.start_date >= v_session.occurrence_date then
      delete from public.class_series where id = v_series.id;
    else
      update public.class_series
        set end_date = v_session.occurrence_date - 1,
          generated_until = least(generated_until, v_session.occurrence_date - 1)
        where id = v_series.id;
    end if;
  else
    return private.class_result('invalid');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.class_upcoming_counts()
returns table (instructor_id uuid, sessions bigint)
language sql stable set search_path = '' as $$
  select instructor_id, count(*)
  from public.class_sessions
  where instructor_id is not null and status <> 'deleted' and starts_at > now()
  group by instructor_id;
$$;

do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'class_extend_series()',
    'class_create(uuid,uuid,uuid,integer,integer,time,date,smallint[],date)',
    'class_update(uuid,uuid,text,uuid,uuid,integer,integer,time,date,smallint[],date)',
    'class_set_status(uuid,uuid,text,text)',
    'class_delete(uuid,uuid,text)',
    'class_upcoming_counts()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', v_name);
    execute format('grant execute on function public.%s to service_role', v_name);
  end loop;
end;
$$;
revoke all on function private.class_lock(), private.class_today(), private.class_horizon(),
  private.class_at(date, time), private.class_result(text, jsonb),
  private.class_type_usable(uuid), private.class_instructor_usable(uuid),
  private.class_conflicts(uuid, tstzrange[], uuid[], uuid, date),
  private.class_rule_dates(smallint[], time, date, date),
  private.class_fill_series(public.class_series, date, date),
  private.class_extend(), private.class_editable(uuid)
  from public, anon, authenticated;
-- The public RPCs run as the invoking service role and need these private helpers.
grant usage on schema private to service_role;
grant execute on function private.class_lock(), private.class_today(), private.class_horizon(),
  private.class_at(date, time), private.class_result(text, jsonb),
  private.class_type_usable(uuid), private.class_instructor_usable(uuid),
  private.class_conflicts(uuid, tstzrange[], uuid[], uuid, date),
  private.class_rule_dates(smallint[], time, date, date),
  private.class_fill_series(public.class_series, date, date),
  private.class_extend(), private.class_editable(uuid)
  to service_role;

-- Removing an instructor (flag off, deactivation, or the deactivation step of deletion)
-- leaves future sessions unassigned. Hard deletion also clears past sessions via the FKs.
create function private.staff_release_classes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (old.is_active and not new.is_active) or (old.is_instructor and not new.is_instructor) then
    perform private.class_lock();
    update public.class_sessions set instructor_id = null
      where instructor_id = new.id and starts_at > now();
    update public.class_series set instructor_id = null
      where instructor_id = new.id
        and (end_date is null or end_date >= private.class_today());
  end if;
  return new;
end;
$$;
revoke all on function private.staff_release_classes() from public, anon, authenticated;
create trigger staff_release_classes after update on public.staff
for each row execute function private.staff_release_classes();
