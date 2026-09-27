import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { apiRouter } from './routes/api';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static files for web UI dashboard
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // REST API Routes
  app.use('/api', apiRouter);

  // Root fallback serves dashboard index.html if exists
  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
