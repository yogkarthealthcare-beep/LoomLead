const fs = require('fs');
const path = require('path');
const db = require('./db');

async function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  console.log('Reading schema from:', schemaPath);
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Executing database schema on LoomLeadDB...');
  const client = await db.pool.connect();
  try {
    await client.query(sql);
    console.log('✅ Schema and seeds executed successfully!');

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📊 Created Tables in LoomLeadDB:');
    res.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });

    // Check plans count
    const plansRes = await client.query('SELECT code, name, price_monthly FROM plans ORDER BY id ASC;');
    console.log('\n💳 Seeded Plans:');
    plansRes.rows.forEach(p => console.log(`  - ${p.name} (${p.code}): ₹${p.price_monthly}/mo`));

    // Check seeded users
    const usersRes = await client.query('SELECT name, email, role FROM users;');
    console.log('\n👤 Seeded Users:');
    usersRes.rows.forEach(u => console.log(`  - ${u.name} (${u.email}) [Role: ${u.role}]`));

  } catch (err) {
    console.error('❌ Error executing schema:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

initializeDatabase();
