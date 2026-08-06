/*
# AI Email Assistant Schema

## Overview
Single-tenant (no auth) schema for an AI email assistant that reads incoming emails,
understands intent, detects emotion, flags fraud, summarizes threads, predicts
satisfaction, drafts replies, creates tasks, schedules meetings, updates a CRM,
escalates urgent issues, and recommends the next best action — while learning a
company-specific writing style from approved reply samples.

## New Tables

1. `emails` — incoming and outgoing email messages
   - `id` uuid PK
   - `from_address` text (sender)
   - `from_name` text (sender display name)
   - `to_address` text (recipient, usually the company)
   - `subject` text
   - `body` text (full body)
   - `received_at` timestamptz
   - `thread_id` text (groups messages in a conversation)
   - `is_read` boolean default false
   - `ai_intent` text (detected intent: inquiry, complaint, support, billing, meeting_request, fraud, praise, other)
   - `ai_emotion` text (detected emotion: positive, neutral, frustrated, angry, confused, urgent)
   - `ai_emotion_score` numeric 0-100 (intensity)
   - `ai_urgency` text (low, medium, high, critical)
   - `ai_fraud_risk` numeric 0-100
   - `ai_fraud_flags` text[] (matched fraud indicators)
   - `ai_satisfaction` numeric 0-100 (predicted customer satisfaction)
   - `ai_summary` text (thread summary)
   - `ai_next_action` text (recommended next best action)
   - `ai_reply_draft` text (drafted reply in company style)
   - `ai_analyzed_at` timestamptz
   - `status` text (new, triaged, replied, escalated, resolved)

2. `tasks` — tasks created from emails
   - `id` uuid PK
   - `email_id` uuid FK -> emails
   - `title` text
   - `description` text
   - `priority` text (low, medium, high)
   - `due_date` date
   - `status` text (pending, in_progress, done)
   - `created_at` timestamptz

3. `crm_contacts` — lightweight CRM contacts
   - `id` uuid PK
   - `email` text unique
   - `name` text
   - `company` text
   - `tier` text (free, pro, enterprise)
   - `status` text (active, churned, lead)
   - `satisfaction_trend` text (improving, stable, declining)
   - `last_contact_at` timestamptz
   - `notes` text
   - `created_at` timestamptz

4. `actions` — audit log of AI-recommended and user-taken actions
   - `id` uuid PK
   - `email_id` uuid FK -> emails
   - `type` text (draft_reply, create_task, schedule_meeting, escalate, update_crm, mark_fraud)
   - `label` text (human-readable)
   - `detail` text
   - `performed_by` text (ai, user)
   - `created_at` timestamptz

5. `writing_samples` — approved reply texts used to learn company writing style
   - `id` uuid PK
   - `content` text (approved reply body)
   - `tone` text (formal, friendly, concise)
   - `created_at` timestamptz

## Security
- RLS enabled on all tables.
- Single-tenant (no sign-in): policies use `TO anon, authenticated` with `USING (true)`
  because the data is intentionally shared/public within this demo app.
*/

CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address text NOT NULL,
  from_name text,
  to_address text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  received_at timestamptz DEFAULT now(),
  thread_id text DEFAULT gen_random_uuid(),
  is_read boolean NOT NULL DEFAULT false,
  ai_intent text,
  ai_emotion text,
  ai_emotion_score numeric,
  ai_urgency text,
  ai_fraud_risk numeric,
  ai_fraud_flags text[],
  ai_satisfaction numeric,
  ai_summary text,
  ai_next_action text,
  ai_reply_draft text,
  ai_analyzed_at timestamptz,
  status text NOT NULL DEFAULT 'new'
);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_emails" ON emails;
CREATE POLICY "anon_select_emails" ON emails FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_emails" ON emails;
CREATE POLICY "anon_insert_emails" ON emails FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_emails" ON emails;
CREATE POLICY "anon_update_emails" ON emails FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_emails" ON emails;
CREATE POLICY "anon_delete_emails" ON emails FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  company text,
  tier text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'lead',
  satisfaction_trend text,
  last_contact_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_crm" ON crm_contacts;
CREATE POLICY "anon_select_crm" ON crm_contacts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_crm" ON crm_contacts;
CREATE POLICY "anon_insert_crm" ON crm_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_crm" ON crm_contacts;
CREATE POLICY "anon_update_crm" ON crm_contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_crm" ON crm_contacts;
CREATE POLICY "anon_delete_crm" ON crm_contacts FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text NOT NULL,
  detail text,
  performed_by text NOT NULL DEFAULT 'ai',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_actions" ON actions;
CREATE POLICY "anon_select_actions" ON actions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_actions" ON actions;
CREATE POLICY "anon_insert_actions" ON actions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_actions" ON actions;
CREATE POLICY "anon_delete_actions" ON actions FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS writing_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  tone text NOT NULL DEFAULT 'friendly',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE writing_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_writing" ON writing_samples;
CREATE POLICY "anon_select_writing" ON writing_samples FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_writing" ON writing_samples;
CREATE POLICY "anon_insert_writing" ON writing_samples FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_writing" ON writing_samples;
CREATE POLICY "anon_delete_writing" ON writing_samples FOR DELETE TO anon, authenticated USING (true);
