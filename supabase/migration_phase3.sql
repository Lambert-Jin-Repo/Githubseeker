-- Phase 3: Polish & Robustness migration
-- Applied via Supabase MCP apply_migration

-- Task 6: Feedback unique constraint (enables upsert deduplication)
ALTER TABLE feedback ADD CONSTRAINT feedback_unique_per_signal UNIQUE (search_id, repo_url, signal);

-- Task 7: Count function for history endpoint optimization
CREATE OR REPLACE FUNCTION count_results_by_search(search_ids uuid[])
RETURNS TABLE(search_id uuid, count bigint) LANGUAGE sql STABLE AS $$
  SELECT sr.search_id, COUNT(*) FROM search_results sr
  WHERE sr.search_id = ANY(search_ids) GROUP BY sr.search_id;
$$;

-- Task 3: Index for cache lookup (same user + query, recent, phase1 complete)
CREATE INDEX idx_searches_cache_lookup ON searches(user_id, query, created_at DESC) WHERE phase1_complete = true;
