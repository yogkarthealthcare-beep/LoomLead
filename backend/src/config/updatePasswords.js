const bcrypt = require('bcryptjs');
const db = require('./db');

async function updatePasswords() {
  const hash = await bcrypt.hash('password123', 10);
  console.log('Generated hash for password123:', hash);
  await db.query('UPDATE users SET password_hash = $1', [hash]);
  console.log('✅ Successfully updated all user password hashes in LoomLeadDB!');
  process.exit(0);
}

updatePasswords().catch(err => {
  console.error(err);
  process.exit(1);
});
