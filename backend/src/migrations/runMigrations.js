const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  const client = await db.pool.connect();

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Read all SQL files in migrations folder
    const migrationsDir = path.resolve(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const checkRes = await client.query(
        'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
        [file]
      );

      if (checkRes.rows.length === 0) {
        console.log(`⏳ Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied migration: ${file}`);
      } else {
        console.log(`⏩ Skipping already applied migration: ${file}`);
      }
    }

    console.log('🎉 All migrations applied successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}

module.exports = { runMigrations };
