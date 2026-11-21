# Multi-Event Seating Model

The seating manager now starts with an annual-event chooser. The current catalog is:

| Code | Event | Chart | State |
| --- | --- | --- | --- |
| FSJW 26 | Florida Smooth Jazz Weekend 2026 | Existing theater chart | Live |
| RBNYE 26 | Rick Braun's New Year's Eve 2026 | Table chart | Awaiting table layout + data scope |
| DJW 27 | Daytona Jazz Weekend 2027 | To be defined | Provisioned |

## Data-safety rule

Each event must be isolated in the database. A RezMagic import, renewal, group, seat assignment, audit entry, snapshot, and change queue may only read and write records for its selected event. In particular, the authoritative CSV import must never delete or replace another event's seats.

FSJW 26 remains on its current data model until the database can be inspected while active. Do not turn on imports for RBNYE 26 or DJW 27 until the database migration has been tested with the live schema and RLS policies.

## Required migration work

When the Supabase project is active, inspect the current primary keys, unique constraints, foreign keys, and RLS policies before changing anything. Then:

1. Add an `events` record for each annual event.
2. Add a required event scope to reservations, guests, seats, groups, group members, imports, snapshots, change records, audits, and historical seating records.
3. Replace unique keys that currently assume one event (especially seat IDs and reservation/guest pairs) with event-scoped keys.
4. Backfill all existing records as `fsjw26` before enforcing `NOT NULL`.
5. Update every PostgREST query and every upsert conflict target to include the event scope.
6. Verify RLS permits authorized staff to use their events, while preventing cross-event access.
7. Test an RBNYE import and seat replacement against a disposable copy before enabling it in the live manager.

## RBNYE chart input needed

Provide the final room diagram or a list of every table number, its seat count, and its floor placement. The table map will use that exact source; it should not be guessed from the FSJW theater layout.
