import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
};

// For production with SSL (uncomment if needed)
// if (process.env.NODE_ENV === 'production') {
//   poolConfig.ssl = {
//     rejectUnauthorized: false
//   };
// }

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
  process.exit(-1);
});

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