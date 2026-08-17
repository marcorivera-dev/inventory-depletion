import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import cron from 'node-cron';
import { runDepletion } from './depletion.js';

async function run(reason) {
  console.log(`\n⏰ Scheduler: ${reason}`);
  try {
    const result = await runDepletion();
    console.log('Depletion result:', result);
  } catch (err) {
    console.error('Depletion error:', err);
  }
}

try {
  // Mexico City is permanently UTC-6 (no daylight saving since 2023).
  // The cron uses UTC directly so it doesn't depend on the host's tzdata.
  //   Monday–Saturday 21:30 MX -> 03:30 UTC (Tuesday–Sunday)
  //   Sunday          20:30 MX -> 02:30 UTC (Monday)
  cron.schedule('30 3 * * 2-7', () => {
    console.log('🔔 NIGHTLY CRON TRIGGERED:', new Date());
    run('Automatic depletion Mon–Sat 21:30 MX');
  });
  cron.schedule('30 2 * * 1', () => {
    console.log('🔔 NIGHTLY CRON TRIGGERED:', new Date());
    run('Automatic depletion Sun 20:30 MX');
  });
  cron.schedule('0 * * * *', () => console.log(`💓 Heartbeat: ${new Date().toISOString()}`));

  console.log('✓ Scheduler running:');
  console.log('  Mon–Sat -> 03:30 UTC (= 21:30 Mexico City time)');
  console.log('  Sun     -> 02:30 UTC (= 20:30 Mexico City time)');
  console.log('  Heartbeat: every hour\n');
} catch (err) {
  console.error('⚠️  Scheduler failed to start:', err.message);
}

// To run manually without waiting for the cron: node -e "..." or from a PM2 console.
export async function runManualDepletion() {
  return run('Manual depletion');
}
