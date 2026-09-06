import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_SECRET', 'PORT'] as const;

let failed = false;
for (const key of required) {
  const value = process.env[key];
  if (!value || !String(value).trim()) {
    console.error(`Missing required environment variable: ${key}`);
    failed = true;
  }
}

if (failed) {
  console.error('');
  console.error('Copy .env.example to .env and fill in the values, then try again.');
  process.exit(1);
}

if (process.env.JWT_SECRET === 'change-this-secret' || process.env.JWT_SECRET === 'dev-only-change-me') {
  console.warn('Warning: JWT_SECRET is using a weak/default value. Change it before production.');
}

console.log('Environment variables OK.');
