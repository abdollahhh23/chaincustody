import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Nationalkite@localhost:5432/chaincustody'
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
