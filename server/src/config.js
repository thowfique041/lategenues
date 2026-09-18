import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lategenues',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
