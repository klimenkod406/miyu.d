import { runQuery, getAll } from '../db';

(async () => {
  // Find duplicate concerts (same title + venue + event_date), keep the one with min id.
  const rows = await getAll<any>(
    `SELECT MIN(id) as keep_id, GROUP_CONCAT(id) as all_ids, COUNT(*) as cnt, title
       FROM concerts
       GROUP BY title, venue, event_date
       HAVING cnt > 1`
  );

  if (rows.length === 0) {
    console.log('No duplicates found.');
    process.exit(0);
  }

  const idsToDelete: number[] = [];
  for (const r of rows) {
    const all = String(r.all_ids).split(',').map(Number);
    const dups = all.filter(id => id !== r.keep_id);
    idsToDelete.push(...dups);
    console.log(`"${r.title}": keep ${r.keep_id}, delete [${dups.join(', ')}]`);
  }

  if (idsToDelete.length === 0) {
    process.exit(0);
  }

  const placeholders = idsToDelete.map(() => '?').join(',');

  await runQuery('BEGIN TRANSACTION');
  // Delete tickets first (in case there are any)
  await runQuery(
    `DELETE FROM tickets WHERE ticket_type_id IN (SELECT id FROM ticket_types WHERE concert_id IN (${placeholders}))`,
    idsToDelete
  );
  await runQuery(`DELETE FROM ticket_types WHERE concert_id IN (${placeholders})`, idsToDelete);
  await runQuery(`DELETE FROM concerts WHERE id IN (${placeholders})`, idsToDelete);
  await runQuery('COMMIT');

  console.log(`Deleted ${idsToDelete.length} duplicate concerts.`);
  process.exit(0);
})();
