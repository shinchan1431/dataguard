/*
# Add calendar meetings and spam detection

## Overview
1. Adds a `meetings` table for scheduling meetings from emails.
2. Adds `ai_spam_risk` (numeric) and `ai_spam_flags` (text[]) columns to `emails`
   so the AI can distinguish spam (unsolicited bulk/marketing) from fraud
   (phishing/scams targeting the user).

## New Tables
- `meetings`
  - `id` uuid PK
  - `email_id` uuid FK -> emails (nullable, meetings can be standalone)
  - `title` text
  - `attendee_email` text
  - `attendee_name` text
  - `scheduled_at` timestamptz (when the meeting starts)
  - `duration_minutes` int default 30
  - `location` text (e.g. "Zoom", "Office", "Phone")
  - `status` text (scheduled, completed, cancelled)
  - `notes` text
  - `created_at` timestamptz

## Modified Tables
- `emails` — two new columns:
  - `ai_spam_risk` numeric (0-100)
  - `ai_spam_flags` text[] (matched spam indicators)

## Security
- RLS enabled on `meetings` with anon+authenticated CRUD (single-tenant, no auth).
- Existing emails policies cover the new columns automatically.
*/

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  title text NOT NULL,
  attendee_email text NOT NULL,
  attendee_name text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  location text NOT NULL DEFAULT 'Zoom',
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_meetings" ON meetings;
CREATE POLICY "anon_select_meetings" ON meetings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_meetings" ON meetings;
CREATE POLICY "anon_insert_meetings" ON meetings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_meetings" ON meetings;
CREATE POLICY "anon_update_meetings" ON meetings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_meetings" ON meetings;
CREATE POLICY "anon_delete_meetings" ON meetings FOR DELETE
  TO anon, authenticated USING (true);

-- Add spam columns to emails (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'ai_spam_risk') THEN
    ALTER TABLE emails ADD COLUMN ai_spam_risk numeric;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'ai_spam_flags') THEN
    ALTER TABLE emails ADD COLUMN ai_spam_flags text[];
  END IF;
END $$;
