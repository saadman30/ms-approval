import { Pool, PoolConfig } from 'pg';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5436'),
  database: process.env.DB_NAME || 'audit',
  user: process.env.DB_USER || 'audit_user',
  password: process.env.DB_PASSWORD || 'audit_pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});
