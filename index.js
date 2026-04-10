import express from 'express';
import dotenv from 'dotenv';
import pool, { connectWithRetry, getDBStatus } from './db.js';
import userRoutes from './routes/userRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import usageRoutes from './routes/usageRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import tipsRoutes from './routes/tipsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import datasetRoutes from './routes/datasetRoutes.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for mobile app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'EcoGuard API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      users: '/api/users',
      devices: '/api/devices',
      usage: '/api/usage',
      gamification: '/api/gamification',
      tips: '/api/tips',
      dataset: '/api/dataset',
      health: '/health'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/dataset', datasetRoutes);

// Health check
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
  res.status(httpStatus).json(status);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down...');
  await pool.end();
  console.log('✅ Database pool closed');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const startServer = async () => {
  const isConnected = await connectWithRetry(5, 3000);

  if (!isConnected) {
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`👥 Users: http://localhost:${PORT}/api/users`);
    console.log(`📱 Devices: http://localhost:${PORT}/api/devices`);
    console.log(`📊 Stats: http://localhost:${PORT}/api/devices/stats`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
};

startServer();