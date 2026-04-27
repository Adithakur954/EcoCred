import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const rawConnectionString = process.env.DATABASE_URL || '';
const connectionString = rawConnectionString.replace(/sslmode=require/gi, 'sslmode=no-verify');

const sslMode = (process.env.DB_SSL || process.env.PGSSLMODE || '').toLowerCase();
const shouldUseSSL = ['true', '1', 'require', 'no-verify'].includes(sslMode);

// Configuration
const poolConfig = {
  connectionString,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

if (shouldUseSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

// Event listeners
pool.on('connect', (client) => {
  console.log('✅ New client connected to database');
});

pool.on('acquire', (client) => {
  console.log('📗 Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('📕 Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client:', err.message);
});

const keepAliveIntervalMs = Number(process.env.DB_KEEPALIVE_INTERVAL_MS || 240000);

if (keepAliveIntervalMs > 0) {
  const keepAliveTimer = setInterval(async () => {
    try {
      await pool.query('SELECT 1');
      console.log('Database keep-alive ping successful');
    } catch (error) {
      console.error('Database keep-alive ping failed:', error.message);
    }
  }, keepAliveIntervalMs);

  keepAliveTimer.unref();
}

// Simple connection check
export const checkConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection verified');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Get database status
export const getDBStatus = async () => {
  try {
    const result = await pool.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        inet_server_addr() as host,
        inet_server_port() as port
    `);

    return {
      connected: true,
      timestamp: new Date().toISOString(),
      database: result.rows[0].database,
      user: result.rows[0].user,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Ensure schema stays compatible with current controllers/routes.
export const ensureSchemaCompatibility = async () => {
  // devices table: migrate legacy columns (name/type) to current schema.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'name'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'device_name'
      ) THEN
        ALTER TABLE devices RENAME COLUMN name TO device_name;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'type'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'device_type'
      ) THEN
        ALTER TABLE devices RENAME COLUMN type TO device_type;
      END IF;
    END
    $$;
  `);

  await pool.query(`
    ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS device_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS device_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS location VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_active TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_device_id_unique
    ON devices(device_id);
  `);

  await pool.query(`
    ALTER TABLE gamification_badges
      ADD COLUMN IF NOT EXISTS icon_url TEXT;
  `);
};

// Connect with retry logic
export const connectWithRetry = async (maxRetries = 5, delay = 3000) => {
  for (let i = 1; i <= maxRetries; i++) {
    console.log(`🔄 Database connection attempt ${i}/${maxRetries}...`);

    const isConnected = await checkConnection();

    if (isConnected) {
      console.log('✅ Database connected successfully!');

      // Log connection info
      const status = await getDBStatus();
      if (status.connected) {
        console.log(`📊 Database: ${status.database}`);
        console.log(`👤 User: ${status.user}`);
        console.log(`🔢 Version: ${status.version}`);
      }

      await ensureSchemaCompatibility();
      console.log('✅ Database schema compatibility check completed');

      return true;
    }

    if (i < maxRetries) {
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error('❌ Failed to connect to database after all retries');
  return false;
};

// Query helper with error handling
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', { text, error: error.message });
    throw error;
  }
};

export default pool;
