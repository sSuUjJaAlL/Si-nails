import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const jwtSecret = process.env.JWT_SECRET || 'dev-only-change-me';

if (isProd) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (!process.env.JWT_SECRET || jwtSecret === 'dev-only-change-me' || jwtSecret === 'change-this-secret') {
    throw new Error('JWT_SECRET must be set to a strong unique value in production');
  }
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv,
  jwtSecret,
  jwtExpiresIn: '7d' as const,
  cookieName: 'sinails_token',
  isProd,
  appUrl: (process.env.APP_URL || '').replace(/\/$/, ''),
};
