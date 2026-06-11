import { getAll } from '../db';

(async () => {
  const rows = await getAll<any>(
    `SELECT id, title, venue, event_date, created_at FROM concerts ORDER BY id`
  );
  console.table(rows);
  console.log(`Total: ${rows.length}`);
  process.exit(0);
})();
