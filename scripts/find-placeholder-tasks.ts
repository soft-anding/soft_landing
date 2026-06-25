/**
 * Scans every row in moving_tasks (regardless of verified flag) and reports
 * any that still carry placeholder / review-flag text in summary or action_steps.
 *
 * Patterns checked:
 *   [RAW  |  rewrite before publishing  |  [TODO  |  text that starts with [
 *
 * Usage:
 *   npm run find:placeholders
 *
 * Copy the SQL block printed at the end into the Supabase SQL editor to
 * rewrite the affected rows individually.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "backend/.env" });

const PLACEHOLDER_STRINGS = [
  "[RAW",
  "RAW —",
  "rewrite before publishing",
  "[TODO",
  "TODO:",
];

function containsPlaceholder(value: string | null | undefined): boolean {
  if (!value) return false;
  return PLACEHOLDER_STRINGS.some((p) => value.includes(p));
}

function checkRow(row: {
  id: number;
  title_he: string | null;
  summary: string | null;
  action_steps: string[] | null;
}): { inSummary: boolean; badSteps: string[] } {
  const inSummary = containsPlaceholder(row.summary);
  const badSteps = (row.action_steps ?? []).filter(containsPlaceholder);
  return { inSummary, badSteps };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const sb = createClient(url, key);

  // Fetch ALL rows — verified=false rows are the most likely to have placeholders.
  const { data, error } = await sb
    .from("moving_tasks")
    .select("id,title_he,summary,action_steps")
    .order("id");

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const rows = data ?? [];
  const affected: typeof rows = [];

  for (const row of rows) {
    const { inSummary, badSteps } = checkRow(row);
    if (inSummary || badSteps.length > 0) affected.push(row);
  }

  if (affected.length === 0) {
    console.log("\n✅  No placeholder text found in moving_tasks — all clear.\n");
    return;
  }

  console.log(`\n⚠️   ${affected.length} task(s) still contain placeholder / review-flag text:\n`);
  console.log("─".repeat(72));

  for (const row of affected) {
    const { inSummary, badSteps } = checkRow(row);
    console.log(`\nid=${row.id}  "${row.title_he ?? "(no title)"}"`);
    if (inSummary) {
      console.log(`  ⛳ summary:\n     ${(row.summary ?? "").slice(0, 200)}`);
    }
    if (badSteps.length > 0) {
      console.log(`  ⛳ action_steps (${badSteps.length} flagged):`);
      badSteps.forEach((s) => console.log(`     • ${s.slice(0, 160)}`));
    }
  }

  // Emit a ready-to-paste SQL snippet to help the user locate rows quickly.
  const ids = affected.map((r) => r.id).join(", ");
  console.log("\n" + "─".repeat(72));
  console.log("\nSQL to inspect these rows in the Supabase SQL editor:\n");
  console.log(
    `  SELECT id, title_he, summary, action_steps\n` +
    `  FROM   moving_tasks\n` +
    `  WHERE  id IN (${ids})\n` +
    `  ORDER  BY id;\n`
  );
  console.log(
    "Run the query, rewrite the content for each row, then set verified = true.\n"
  );
}

main().catch((err) => {
  console.error("\n❌ ", err.message);
  process.exit(1);
});
