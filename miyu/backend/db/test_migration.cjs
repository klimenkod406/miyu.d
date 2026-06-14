const { migrate, closeDb } = require('./migrate');
migrate()
  .then(() => {
    console.log('Migration completed successfully');
    return closeDb();
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
