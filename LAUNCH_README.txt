FSJW26 SHARED SEATING MANAGER — LAUNCH BUILD

SECURITY
- No raw RezMagic CSV is embedded in this website.
- Raw CSV is read locally in the authenticated browser only.
- Email, phone, payment/balance fields are not uploaded.
- Free-text comments are scrubbed; higher-risk items are held before upload.
- No service-role or secret Supabase key is in the browser.
- Existing Supabase RLS remains the database security boundary.

WORKFLOW
- Seat move -> RezMagic Updates: Needs Update.
- Staff manually changes RezMagic -> Mark Entered.
- Next CSV -> matching seat becomes Verified/Synced; unexpected seat becomes Conflict.
- Reservation notes are stored in the existing audit_log as reservation_note records.
