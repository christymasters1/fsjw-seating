# Multi-Event Seating Model

The seating manager now starts with an annual-event chooser. The current catalog is:

| Code | Event | Chart | State |
| --- | --- | --- | --- |
| FSJW 26 | Florida Smooth Jazz Weekend 2026 | Existing theater chart | Live |
| RBNYE 26 | Rick Braun's New Year's Eve 2026 | 102-table chart | Live workspace; ready for its first RezMagic file |
| DJW 27 | Daytona Jazz Weekend 2027 | To be defined | Provisioned |

## Data-safety rule

Each event must be isolated in the database. A RezMagic import, renewal, group, seat assignment, audit entry, snapshot, and change queue may only read and write records for its selected event. In particular, the authoritative CSV import must never delete or replace another event's seats.

The live database now enforces this model with `event_id` on every operational table. All existing records were backfilled as `fsjw26` without changing their reservation, guest, seat, group, import, snapshot, audit, or renewal-history values. The manager adds the selected event to every PostgREST read, write, delete, and upsert; database keys and foreign keys also require that related records have the same event.

## Completed database migration

The migration is recorded in `supabase/migrations/20261121154500_event_scoped_annual_seating.sql`. It:

1. Adds `seating_events` records for FSJW 26, RBNYE 26, and DJW 27.
2. Adds a non-null `event_id` to all event-owned records.
3. Converts the reservation primary key and every affected unique key and foreign key to event-scoped versions.
4. Keeps all existing FSJW data in place as `fsjw26`.
5. Adds event-leading indexes for the manager's normal reservation, guest, seat, queue, import, snapshot, and renewal-history queries.

The existing staff RLS policies remain in effect; the event boundary is enforced by the application's mandatory event filter and the database's composite relationships. No staff accounts or permissions were removed.

## RBNYE chart source

The approved RBNYE 26 chart is encoded in `src/index.html`:

- Tables 1–102, with 10 seats at every table (1,020 table seats total).
- Blue tables: 4–9, 17–22, 31–36, and 45–49.
- Gold tables: all other numbered tables.
- Stage centered between the two dance floors; a video screen above each dance floor.
- The live map uses table-chair IDs such as `T004-01` (table 4, chair 1). Imports also accept clear equivalents such as `Table 4 Seat 1`, `T4-1`, or `4-1`; table-only assignments are rejected because they would not identify a unique guest chair.

The layout is a dedicated RBNYE source and is not inferred from the FSJW theater map.
