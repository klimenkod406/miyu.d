import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

const db = new sqlite3.Database('./database/miyu.db');

async function createUsers() {
  const artistPassword = await bcrypt.hash('artist123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  db.serialize(() => {
    db.run(`INSERT OR IGNORE INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['artist@miyu.ru', 'MiYu Artist', artistPassword, 'artist'], (err: any) => {
        if (err) console.log('Artist exists or error:', err?.message);
        else console.log('✓ Artist created: artist@miyu.ru / artist123');
    });

    db.run(`INSERT OR IGNORE INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['admin@miyu.ru', 'MiYu Admin', adminPassword, 'admin'], (err: any) => {
        if (err) console.log('Admin exists or error:', err?.message);
        else console.log('✓ Admin created: admin@miyu.ru / admin123');
    });
  });

  setTimeout(() => {
    db.all('SELECT id, email, username, role FROM users', [], (err: any, rows: any) => {
      if (err) console.error('Error:', err);
      else console.log('\nAll users:', rows);
      db.close();
      process.exit(0);
    });
  }, 500);
}

createUsers();