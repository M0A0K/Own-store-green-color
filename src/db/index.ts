import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Pool as PoolType } from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

declare global {
  var _postgresPool: PoolType | undefined;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(
    process.env.SQL_HOST ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.PGHOST
  );
}

export const createPool = (): PoolType => {
  if (!global._postgresPool) {
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;

    if (connectionString) {
      const useSsl =
        connectionString.includes('rlwy.net') ||
        connectionString.includes('railway') ||
        process.env.PGSSLMODE === 'require';

      global._postgresPool = new Pool({
        connectionString,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
        max: 10,
        connectionTimeoutMillis: 8000,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST || process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.SQL_PORT || process.env.PGPORT || 5432),
        user: process.env.SQL_USER || process.env.PGUSER,
        password: process.env.SQL_PASSWORD || process.env.PGPASSWORD,
        database: process.env.SQL_DB_NAME || process.env.PGDATABASE,
        max: 10,
        connectionTimeoutMillis: 8000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });
