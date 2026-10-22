-- Review fixes for the class schedule functions. No table or data changes.

-- Fill takes the statuses to keep per date so carried-over cancelled/deleted dates are
-- inserted with their final status (inserting them as scheduled first could hit the
-- non-deferrable overlap constraint).
drop function private.class_fill_series(public.class_series, date, date);
create function private.class_fill_series(
  p_series public.class_series,
  p_from date,
  p_to date,
  p_kept_dates date[] default '{}',
  p_kept_status text[] default '{}'
) returns void
language sql volatile set search_path = '' as $$
  insert into public.class_sessions (
    series_id, occurrence_date, class_type_id, instructor_id, starts_at, ends_at,
    capacity, status, created_by
  )
  select p_series.id, d, p_series.class_type_id, p_series.instructor_id,
    private.class_at(d, p_series.start_time),
    private.class_at(d, p_series.start_time) + make_interval(mins => p_series.duration_minutes),
    p_series.capacity,
    coalesce(k.status, case when p_series.cancelled_from is not null and d >= p_series.cancelled_from
      then 'cancelled' else 'scheduled' end),
    p_series.created_by
  from private.class_rule_dates(p_series.weekdays, p_series.start_time, p_from, p_to) d
  left join unnest(p_kept_dates, p_kept_status) k(kept_date, status) on k.kept_date = d
  on conflict (series_id, occurrence_date) do nothing;
$$;
revoke all on function private.class_fill_series(public.class_series, date, date, date[], text[])
  from public, anon, authenticated;
grant execute on function private.class_fill_series(public.class_series, date, date, date[], text[])
  to service_role;

-- Single sessions have no series_id; without coalesce the exclusion test became NULL and hid them.
create or replace function private.class_conflicts(
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
      and not coalesce(s.series_id = p_exclude_series and s.occurrence_date >= p_exclude_from, false)
  ) c;
$$;

-- Removes a series whose remaining sessions are all being replaced. Sessions that already
-- happened (e.g. moved earlier and now past) are kept as standalone records.
create function private.class_drop_series(p_series_id uuid) returns void
language sql volatile set search_path = '' as $$
  update public.class_sessions set series_id = null, occurrence_date = null
    where series_id = p_series_id and status <> 'deleted';
  delete from public.class_series where id = p_series_id;
$$;
revoke all on function private.class_drop_series(uuid) from public, anon, authenticated;
grant execute on function private.class_drop_series(uuid) to service_role;

create or replace function public.class_create(
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
      return private.class_result('start_in_past');
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

create or replace function public.class_update(
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
      return private.class_result('start_in_past');
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

  -- Every existing date in the replaced range keeps its status on the same new date,
  -- including dates restored one by one inside a "cancel all following" range. A date whose
  -- session was moved earlier and already took place is not created again.
  select coalesce(array_agg(occurrence_date), '{}'),
      coalesce(array_agg(case when starts_at <= now() then 'deleted' else status end), '{}')
    into v_kept_dates, v_kept_status
    from public.class_sessions
    where series_id = v_old.id and occurrence_date >= v_split;

  if not exists (select 1 from private.class_rule_dates(p_weekdays, p_start_time, v_split, v_to)) then
    return private.class_result('no_dates');
  end if;
  -- Only dates that end up scheduled are checked for overlaps.
  select array_agg(tstzrange(private.class_at(d, p_start_time),
      private.class_at(d, p_start_time) + make_interval(mins => p_duration_minutes), '[)'))
    into v_ranges
    from private.class_rule_dates(p_weekdays, p_start_time, v_split, v_to) d
    left join unnest(v_kept_dates, v_kept_status) k(kept_date, status) on k.kept_date = d
    where coalesce(k.status, case when v_old.cancelled_from is not null and d >= v_old.cancelled_from
      then 'cancelled' else 'scheduled' end) = 'scheduled';
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
  perform private.class_fill_series(v_new, v_split, v_to, v_kept_dates, v_kept_status);

  if v_old.start_date >= v_split then
    perform private.class_drop_series(v_old.id);
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

create or replace function public.class_set_status(
  p_actor uuid,
  p_session_id uuid,
  p_scope text,
  p_status text
) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_session public.class_sessions;
  v_series public.class_series;
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
    -- Each session is checked against its own instructor (some may have been reassigned).
    select coalesce(jsonb_agg(c order by c->>'starts_at'), '[]'::jsonb) into v_conflicts
      from (
        select instructor_id, array_agg(tstzrange(starts_at, ends_at, '[)')) ranges
        from public.class_sessions
        where series_id = v_series.id and occurrence_date >= v_session.occurrence_date
          and status = 'cancelled' and starts_at > now() and instructor_id is not null
        group by instructor_id
      ) g,
      lateral jsonb_array_elements(private.class_conflicts(g.instructor_id, g.ranges)) c;
    if jsonb_array_length(v_conflicts) > 0 then
      return private.class_result('conflict', v_conflicts);
    end if;
    update public.class_sessions set status = 'scheduled'
      where series_id = v_series.id and occurrence_date >= v_session.occurrence_date
        and status = 'cancelled' and starts_at > now();
    update public.class_series set cancelled_from = null where id = v_series.id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_session.id);
end;
$$;

create or replace function public.class_delete(p_actor uuid, p_session_id uuid, p_scope text) returns jsonb
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
      perform private.class_drop_series(v_series.id);
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
