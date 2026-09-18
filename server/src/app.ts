import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config.js';
import { api } from './routes.js';

export const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.clientUrl.split(',').map(x => x.trim()), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'dev'));
app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/api', api);
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File exceeds the 25 MB limit' });
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong' });
});
