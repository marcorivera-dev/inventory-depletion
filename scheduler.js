import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import cron from 'node-cron';
import { correrDepletion } from './depletion.js';

async function ejecutar(motivo) {
  console.log(`\n⏰ Scheduler: ${motivo}`);
  try {
    const resultado = await correrDepletion();
    console.log('Resultado depletion:', resultado);
  } catch (err) {
    console.error('Error en depletion:', err);
  }
}

try {
  // México City = UTC-6 permanentemente (sin horario de verano desde 2023).
  // Se usa UTC directo en el cron para no depender de tzdata del host.
  //   Lunes–Sábado 21:30 MX → 03:30 UTC (martes–domingo)
  //   Domingo      20:30 MX → 02:30 UTC (lunes)
  cron.schedule('30 3 * * 2-7', () => {
    console.log('🔔 CRON NOCTURNO DISPARADO:', new Date());
    ejecutar('Depletion automático Lun–Sáb 21:30 MX');
  });
  cron.schedule('30 2 * * 1', () => {
    console.log('🔔 CRON NOCTURNO DISPARADO:', new Date());
    ejecutar('Depletion automático Dom 20:30 MX');
  });
  cron.schedule('0 * * * *', () => console.log(`💓 Heartbeat: ${new Date().toISOString()}`));

  console.log('✓ Scheduler corriendo:');
  console.log('  Lun–Sáb → 03:30 UTC (= 21:30 hora México)');
  console.log('  Dom     → 02:30 UTC (= 20:30 hora México)');
  console.log('  Heartbeat: cada hora\n');
} catch (err) {
  console.error('⚠️  Scheduler no pudo iniciar:', err.message);
}

// Para correr manualmente sin esperar al cron: node -e "..." o desde consola PM2.
export async function runManualDepletion() {
  return ejecutar('Depletion manual');
}
