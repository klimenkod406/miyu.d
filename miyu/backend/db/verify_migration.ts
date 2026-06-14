import { migrate, closeDb } from './migrate';
import { db } from './index';

async function main() {
  try {
    await migrate();
    console.log('Migration completed successfully');

    // Check social_accounts table
    const saTable = await new Promise<any>((resolve, reject) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='social_accounts'", (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    console.log(saTable ? '✓ social_accounts table exists' : '✗ social_accounts table NOT found');

    // Check password_hash is nullable
    const pwCol = await new Promise<any>((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, cols: any[]) => {
        if (err) reject(err); else resolve(cols.find((c: any) => c.name === 'password_hash'));
      });
    });
    if (pwCol) {
      console.log(`password_hash: notnull=${pwCol.notnull}`);
      console.log(pwCol.notnull === 0 ? '✓ password_hash is now nullable' : '✗ password_hash still has NOT NULL constraint');
    }

    // Check user count preserved
    const countRow = await new Promise<any>((resolve, reject) => {
      db.get("SELECT COUNT(*) as cnt FROM users", (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    console.log(`Users preserved: ${countRow?.cnt ?? 'unknown'}`);

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await closeDb();
  }
}

main();
