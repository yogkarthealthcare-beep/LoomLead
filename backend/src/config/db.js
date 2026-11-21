const { Pool } = require('pg');
require('dotenv').config();

// Determine SSL config based on DB_SSL setting
let sslConfig = false;
if (process.env.DB_SSL && process.env.DB_SSL !== 'disable' && process.env.DB_SSL !== 'false') {
  sslConfig = { rejectUnauthorized: false };
}

const poolConfig = {
  host: process.env.DB_HOST || '66.116.248.35',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'LoomLeadDB',
  user: process.env.DB_USER || 'loomlead_user',
  password: process.env.DB_PASSWORD || 'LoomLead_Sec2026',
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL Database (LoomLeadDB)');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
