import { createServerClient } from "@/lib/supabase";
import type { DeepDiveResult, DeepDiveResultV2 } from "@/lib/types";

export async function persistDeepDive(
  searchId: string,
  repoUrl: string,
  result: DeepDiveResult | DeepDiveResultV2,
  logPrefix = "[persistence]"
): Promise<void> {
  try {
    const db = createServerClient();
    const { data: updated, error } = await db
      .from("search_results")
      .update({ deep_dive: result })
      .eq("search_id", searchId)
      .eq("repo_url", repoUrl)
      .select("id");

    if (error) {
      console.error(`${logPrefix} Persist error:`, error);
    } else if (!updated || updated.length === 0) {
      console.warn(
        `${logPrefix} Update matched 0 rows for search_id=${searchId}, repo_url=${repoUrl}`
      );
    }
  } catch (e) {
    console.error(`${logPrefix} Persist exception:`, e);
  }
}
