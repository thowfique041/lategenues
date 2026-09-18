import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { config } from './config.js';
import { api } from './routes.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use('/api', api);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong' });
});

mongoose.connect(config.mongoUri).then(() => {
  app.listen(config.port, () => console.log(`LateGenues API running on :${config.port}`));
}).catch((error) => {
  console.error('Database connection failed:', error.message);
  process.exit(1);
});
