-- GitHub Scout Initial Schema Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql

create extension if not exists "uuid-ossp";

create table searches (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  query text not null,
  mode text not null check (mode in ('LEARN', 'BUILD', 'SCOUT')),
  topic_extracted text,
  config jsonb default '{}',
  phase1_complete boolean default false,
  phase2_complete boolean default false,
  observations text[] default '{}',
  created_at timestamptz default now()
);

create table search_results (
  id uuid primary key default uuid_generate_v4(),
  search_id uuid references searches(id) on delete cascade,
  repo_url text not null,
  repo_name text not null,
  stars integer,
  last_commit date,
  primary_language text,
  license text,
  quality_tier integer check (quality_tier in (1, 2, 3)),
  verification jsonb default '{}',
  reddit_signal text default 'no_data',
  summary text,
  source_strategies text[] default '{}',
  deep_dive jsonb,
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key default uuid_generate_v4(),
  search_id uuid references searches(id) on delete cascade,
  repo_url text not null,
  signal text not null check (signal in ('useful', 'not_useful', 'inaccurate')),
  comment text,
  created_at timestamptz default now()
);

create table skill_versions (
  id uuid primary key default uuid_generate_v4(),
  version text not null unique,
  skill_content text not null,
  eval_scores jsonb default '{}',
  active boolean default false,
  created_at timestamptz default now()
);

create index idx_searches_user on searches(user_id);
create index idx_searches_created on searches(created_at desc);
create index idx_results_search on search_results(search_id);
create index idx_results_repo on search_results(repo_url);
create index idx_feedback_search on feedback(search_id);

alter table searches enable row level security;
alter table search_results enable row level security;
alter table feedback enable row level security;

create policy "Users can view own searches"
  on searches for select
  using (user_id = current_setting('app.user_id', true));

create policy "Users can insert own searches"
  on searches for insert
  with check (user_id = current_setting('app.user_id', true));

create policy "Users can view own results"
  on search_results for select
  using (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can insert results"
  on search_results for insert
  with check (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can update own results"
  on search_results for update
  using (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can insert feedback"
  on feedback for insert
  with check (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can view own feedback"
  on feedback for select
  using (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));
