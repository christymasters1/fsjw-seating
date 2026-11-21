begin;

create table if not exists public.seating_events (
  id text primary key check (id ~ '^[a-z0-9]+$'),
  code text not null unique,
  name text not null,
  event_year integer not null check (event_year between 2000 and 2100),
  chart_type text not null check (chart_type in ('theater', 'tables', 'pending')),
  is_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.seating_events (id, code, name, event_year, chart_type, is_ready)
values
  ('fsjw26', 'FSJW 26', 'Florida Smooth Jazz Weekend 2026', 2026, 'theater', true),
  ('rbnye26', 'RBNYE 26', 'Rick Braun''s New Year''s Eve 2026', 2026, 'tables', true),
  ('djw27', 'DJW 27', 'Daytona Jazz Weekend 2027', 2027, 'pending', false)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  event_year = excluded.event_year,
  chart_type = excluded.chart_type,
  is_ready = excluded.is_ready,
  updated_at = now();

alter table public.reservations add column if not exists event_id text;
alter table public.reservation_guests add column if not exists event_id text;
alter table public.seat_assignments add column if not exists event_id text;
alter table public.seating_groups add column if not exists event_id text;
alter table public.group_members add column if not exists event_id text;
alter table public.import_batches add column if not exists event_id text;
alter table public.rezmagic_changes add column if not exists event_id text;
alter table public.snapshots add column if not exists event_id text;
alter table public.audit_log add column if not exists event_id text;
alter table public.historical_guest_records add column if not exists event_id text;
alter table public.historical_links add column if not exists event_id text;

-- All existing production records belong to the already-live FSJW workspace.
update public.reservations set event_id = coalesce(event_id, 'fsjw26');
update public.reservation_guests set event_id = coalesce(event_id, 'fsjw26');
update public.seat_assignments set event_id = coalesce(event_id, 'fsjw26');
update public.seating_groups set event_id = coalesce(event_id, 'fsjw26');
update public.group_members set event_id = coalesce(event_id, 'fsjw26');
update public.import_batches set event_id = coalesce(event_id, 'fsjw26');
update public.rezmagic_changes set event_id = coalesce(event_id, 'fsjw26');
update public.snapshots set event_id = coalesce(event_id, 'fsjw26');
update public.audit_log set event_id = coalesce(event_id, 'fsjw26');
update public.historical_guest_records set event_id = coalesce(event_id, 'fsjw26');
update public.historical_links set event_id = coalesce(event_id, 'fsjw26');

alter table public.reservations alter column event_id set default 'fsjw26';
alter table public.reservation_guests alter column event_id set default 'fsjw26';
alter table public.seat_assignments alter column event_id set default 'fsjw26';
alter table public.seating_groups alter column event_id set default 'fsjw26';
alter table public.group_members alter column event_id set default 'fsjw26';
alter table public.import_batches alter column event_id set default 'fsjw26';
alter table public.rezmagic_changes alter column event_id set default 'fsjw26';
alter table public.snapshots alter column event_id set default 'fsjw26';
alter table public.audit_log alter column event_id set default 'fsjw26';
alter table public.historical_guest_records alter column event_id set default 'fsjw26';
alter table public.historical_links alter column event_id set default 'fsjw26';

alter table public.reservations alter column event_id set not null;
alter table public.reservation_guests alter column event_id set not null;
alter table public.seat_assignments alter column event_id set not null;
alter table public.seating_groups alter column event_id set not null;
alter table public.group_members alter column event_id set not null;
alter table public.import_batches alter column event_id set not null;
alter table public.rezmagic_changes alter column event_id set not null;
alter table public.snapshots alter column event_id set not null;
alter table public.audit_log alter column event_id set not null;
alter table public.historical_guest_records alter column event_id set not null;
alter table public.historical_links alter column event_id set not null;

alter table public.reservation_guests drop constraint reservation_guests_rez_id_fkey;
alter table public.seat_assignments drop constraint seat_assignments_rez_id_fkey;
alter table public.rezmagic_changes drop constraint rezmagic_changes_rez_id_fkey;
alter table public.group_members drop constraint group_members_rez_id_fkey;
alter table public.seat_assignments drop constraint seat_assignments_seat_id_key;
alter table public.historical_guest_records drop constraint historical_guest_records_event_year_historical_rez_id_norma_key;
alter table public.historical_links drop constraint historical_links_event_year_matched_rez_id_linked_rez_id_key;
alter table public.reservations drop constraint reservations_pkey;

alter table public.reservations add constraint reservations_pkey primary key (event_id, rez_id);
alter table public.reservation_guests add constraint reservation_guests_event_rez_guest_key unique (event_id, rez_id, guest_name);
alter table public.reservation_guests add constraint reservation_guests_event_id_id_key unique (event_id, id);
alter table public.seating_groups add constraint seating_groups_event_id_id_key unique (event_id, id);
alter table public.seat_assignments add constraint seat_assignments_event_seat_key unique (event_id, seat_id);
alter table public.historical_guest_records add constraint historical_guest_records_event_year_rez_name_key unique (event_id, event_year, historical_rez_id, normalized_guest_name);
alter table public.historical_links add constraint historical_links_event_year_rez_pair_key unique (event_id, event_year, matched_rez_id, linked_rez_id);

alter table public.reservations add constraint reservations_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.reservation_guests add constraint reservation_guests_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.seat_assignments add constraint seat_assignments_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.seating_groups add constraint seating_groups_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.group_members add constraint group_members_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.import_batches add constraint import_batches_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.rezmagic_changes add constraint rezmagic_changes_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.snapshots add constraint snapshots_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.audit_log add constraint audit_log_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.historical_guest_records add constraint historical_guest_records_event_id_fkey foreign key (event_id) references public.seating_events(id);
alter table public.historical_links add constraint historical_links_event_id_fkey foreign key (event_id) references public.seating_events(id);

alter table public.reservation_guests add constraint reservation_guests_event_rez_fkey
  foreign key (event_id, rez_id) references public.reservations(event_id, rez_id) on delete cascade;
alter table public.seat_assignments add constraint seat_assignments_event_rez_fkey
  foreign key (event_id, rez_id) references public.reservations(event_id, rez_id) on delete cascade;
alter table public.seat_assignments add constraint seat_assignments_event_guest_fkey
  foreign key (event_id, guest_id) references public.reservation_guests(event_id, id) on delete set null;
alter table public.rezmagic_changes add constraint rezmagic_changes_event_rez_fkey
  foreign key (event_id, rez_id) references public.reservations(event_id, rez_id) on delete cascade;
alter table public.rezmagic_changes add constraint rezmagic_changes_event_guest_fkey
  foreign key (event_id, guest_id) references public.reservation_guests(event_id, id) on delete set null;
alter table public.group_members add constraint group_members_event_rez_fkey
  foreign key (event_id, rez_id) references public.reservations(event_id, rez_id) on delete cascade;
alter table public.group_members add constraint group_members_event_guest_fkey
  foreign key (event_id, guest_id) references public.reservation_guests(event_id, id) on delete set null;
alter table public.group_members add constraint group_members_event_group_fkey
  foreign key (event_id, group_id) references public.seating_groups(event_id, id) on delete cascade;

create index if not exists reservations_event_status_rez_idx on public.reservations (event_id, status, rez_id);
create index if not exists reservation_guests_event_rez_name_idx on public.reservation_guests (event_id, rez_id, guest_name);
create index if not exists seat_assignments_event_rez_idx on public.seat_assignments (event_id, rez_id);
create index if not exists seat_assignments_event_guest_idx on public.seat_assignments (event_id, guest_id);
create index if not exists seating_groups_event_idx on public.seating_groups (event_id);
create index if not exists group_members_event_rez_idx on public.group_members (event_id, rez_id);
create index if not exists rezmagic_changes_event_created_idx on public.rezmagic_changes (event_id, created_at desc);
create index if not exists audit_log_event_action_created_idx on public.audit_log (event_id, action, created_at desc);
create index if not exists import_batches_event_imported_idx on public.import_batches (event_id, imported_at desc);
create index if not exists snapshots_event_created_idx on public.snapshots (event_id, created_at desc);
create index if not exists historical_records_event_year_name_idx on public.historical_guest_records (event_id, event_year, guest_name);
create index if not exists historical_links_event_year_rez_idx on public.historical_links (event_id, event_year, matched_rez_id, linked_rez_id);

alter table public.seating_events enable row level security;
create policy "Authenticated staff can read seating events"
  on public.seating_events for select to authenticated using (true);

commit;
