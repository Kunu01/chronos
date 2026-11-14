import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';

import { initDataLayer, getSystemHealth } from './services/dataStore.js';
import { startEphemeralCleanupCron } from './services/cronCleanup.js';
import { mongoSanitizeMiddleware } from './middlewares/sanitize.js';
import { errorHandler, sendSuccess } from './middlewares/errorHandler.js';
import recipeRoutes from './routes/recipeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import configRoutes from './routes/configRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import memoryRoutes from './routes/memoryRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { setupVaultSockets } from './sockets/vaultSocket.js';

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:80',
  'http://localhost',
];

const io = new SocketIOServer(server, {
  cors: {
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
  },
});

app.set('io', io);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitizeMiddleware);
app.use(morgan('dev'));

app.get('/api/v1/health', (_req, res) => {
  return sendSuccess(res, {
    service: 'Project Chronos (CraveBook) API v3.0.0',
    status: 'OK',
    ...getSystemHealth(),
  });
});

// Mount API v1 Routes (Fully aligned with architectural_resolutions.md)
app.use('/api/v1/recipes', recipeRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/memories', memoryRoutes);
app.use('/api/v1/chat', chatRoutes);

app.use(errorHandler);

setupVaultSockets(io);
startEphemeralCleanupCron();

const PORT = process.env.PORT || 5000;

initDataLayer().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CHRONOS] Stealth API & Socket Gateway listening on http://0.0.0.0:${PORT}`);
  });
});
