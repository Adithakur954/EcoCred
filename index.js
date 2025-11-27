import express from 'express';
import dotenv from 'dotenv';
import pool, { connectWithRetry, getDBStatus } from './db.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'EcoCred API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      users: '/api/users',
      health: '/health',
      dbStatus: '/health/db'
    }
  });
});

// API Routes
app.use('/api/users', userRoutes);

// Health check - Simple
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check - Detailed
app.get('/health/db', async (req, res) => {
  const status = await getDBStatus();
  const httpStatus = status.connected ? 200 : 500;
  
  res.status(httpStatus).json({
    server: 'running',
    ...status
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    await pool.end();
    console.log('✅ Database pool closed');
  } catch (error) {
    console.error('❌ Error closing pool:', error.message);
  }
  
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const startServer = async () => {
  console.log('🚀 Starting EcoCred Server...\n');
  
  // Check database connection with retry
  const isConnected = await connectWithRetry(5, 3000);
  
  if (!isConnected) {
    console.error('❌ Failed to connect to database. Server not started.');
    process.exit(1);
  }
  
  console.log(''); // Empty line for better formatting
  
  app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Users API: http://localhost:${PORT}/api/users`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 DB Status: http://localhost:${PORT}/health/db`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
};

startServer();