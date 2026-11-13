begin;

create table public.drum_entries (
  id uuid primary key,
  "locationId" text not null,
  date date not null,
  start integer not null,
  "end" integer not null,
  type text not null check (type in ('open', 'lesson', 'practice', 'blocked')),
  room text,
  student text,
  "openPractice" boolean,
  note text,
  check (start >= 540 and "end" <= 1380 and start < "end" and start % 30 = 0 and "end" % 30 = 0)
);

alter table public.drum_entries add constraint drum_entries_no_overlap
  exclude using gist (int8range((date - date '2000-01-01')::bigint * 1440 + start,
                               (date - date '2000-01-01')::bigint * 1440 + "end", '[)') with &&)
  where (type <> 'open');

create table public.drum_students (
  name text primary key check (length(trim(name)) between 1 and 80)
);

alter table public.drum_entries enable row level security;
alter table public.drum_students enable row level security;

-- Replace this placeholder with the dedicated teacher's Auth User UID.
create policy drum_teacher_entries on public.drum_entries for all to authenticated
  using ((select auth.uid()) = '00000000-0000-0000-0000-000000000000'::uuid);
create policy drum_teacher_students on public.drum_students for all to authenticated
  using ((select auth.uid()) = '00000000-0000-0000-0000-000000000000'::uuid);

revoke all on public.drum_entries, public.drum_students from public, anon, authenticated;
grant select, insert, update, delete on public.drum_entries to authenticated;
grant select, insert on public.drum_students to authenticated;

-- The view owner can read the underlying rows; only these fields are exposed.
create view public.drum_public_schedule with (security_barrier = true) as
select id, "locationId", date, start, "end", type,
       case when type = 'practice' then room end as room,
       case when type = 'practice' then "openPractice" end as "openPractice"
from public.drum_entries
where date >= (now() at time zone 'Asia/Tokyo')::date;

revoke all on public.drum_public_schedule from public, anon, authenticated;
grant select on public.drum_public_schedule to anon, authenticated;

commit;
