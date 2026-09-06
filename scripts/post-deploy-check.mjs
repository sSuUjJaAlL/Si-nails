#!/usr/bin/env node
/**
 * Prints a short post-deploy checklist.
 * Usage: node scripts/post-deploy-check.mjs https://your-app.up.railway.app
 */
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: node scripts/post-deploy-check.mjs https://your-app.up.railway.app');
  process.exit(1);
}

async function main() {
  const health = await fetch(`${base}/api/health`);
  const healthJson = await health.json().catch(() => null);
  console.log('Health:', health.status, healthJson);

  const setup = await fetch(`${base}/api/auth/setup-status`);
  const setupJson = await setup.json().catch(() => null);
  console.log('Setup:', setup.status, setupJson);

  if (!health.ok) {
    console.error('FAIL: health check did not return OK');
    process.exit(1);
  }
  if (!setupJson?.setupRequired) {
    console.warn('NOTE: setupRequired is false — an ADMIN already exists on this database.');
  } else {
    console.log('OK: first visit should show Create Admin Account.');
  }
  console.log(`Open: ${base}/setup`);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
