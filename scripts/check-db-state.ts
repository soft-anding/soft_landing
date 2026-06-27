import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data: tasks, error: tasksErr } = await sb
    .from('moving_tasks')
    .select('id, title_he, category, clean_content, parent_title, summary, action_steps')
    .order('id');

  console.log('\n=== moving_tasks ===');
  if (tasksErr) console.log(`  SELECT ERROR: ${tasksErr.message}`);
  console.log(`Total rows returned: ${tasks?.length ?? 0}`);
  for (const t of tasks ?? []) {
    console.log(`\n  id=${t.id} | category=${t.category} | title=${t.title_he}`);
    console.log(`  summary: ${(t.summary as string)?.slice(0, 120) ?? '(null)'}`);
    const steps = t.action_steps as string[] | null;
    if (steps?.length) console.log(`  steps: ${steps.slice(0,2).map((s:string)=>s.slice(0,60)).join(' | ')}`);
  }

  const { count: tasksNullEmb } = await sb.from('moving_tasks').select('id', { count: 'exact', head: true }).is('embedding', null);
  const { count: tasksHasEmb } = await sb.from('moving_tasks').select('id', { count: 'exact', head: true }).not('embedding', 'is', null);
  const { count: tasksNullContent } = await sb.from('moving_tasks').select('id', { count: 'exact', head: true }).is('clean_content', null);

  console.log(`\n  Embedding — null: ${tasksNullEmb}, non-null: ${tasksHasEmb} | clean_content null: ${tasksNullContent}`);

  const { count: rightsTotal } = await sb.from('rights_items').select('id', { count: 'exact', head: true });
  const { count: rightsNullEmb } = await sb.from('rights_items').select('id', { count: 'exact', head: true }).is('embedding', null);
  const { count: rightsHasEmb } = await sb.from('rights_items').select('id', { count: 'exact', head: true }).not('embedding', 'is', null);
  const { count: rightsNullContent } = await sb.from('rights_items').select('id', { count: 'exact', head: true }).is('clean_content', null);

  console.log('\n=== rights_items ===');
  console.log(`Total rows: ${rightsTotal} | Embedding — null: ${rightsNullEmb}, non-null: ${rightsHasEmb} | clean_content null: ${rightsNullContent}`);
}

main().catch(console.error);
