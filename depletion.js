import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { RECETAS } from './recetas.js';
import { MAPEO } from './mapeo.js';
import { INGREDIENTES, MILK_VARIANTS, TEA_VARIANTS } from './ingredientes.js';

const MAPEO_LOWER = Object.fromEntries(
  Object.entries(MAPEO).map(([k, v]) => [k.toLowerCase().trim(), v])
);

const STORE_ID   = process.env.LOYVERSE_STORE_ID;
const API_BASE   = 'https://api.loyverse.com/v1.0';
const LOTE_SIZE  = 20;   // items por batch al POS
const LOTE_DELAY = 500;  // ms entre batches

const headers = () => ({
  Authorization: `Bearer ${process.env.LOYVERSE_TOKEN}`,
  'Content-Type': 'application/json',
});

// ════════════════════════════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════════════════════════════

function getHoyMexicoCity() {
  const now  = new Date();
  // Mexico City es UTC-6 permanentemente desde 2023 (sin DST)
  const fecha = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const [y, m, d] = fecha.split('-').map(Number);
  const inicioUTC = new Date(Date.UTC(y, m - 1, d, 6, 0, 0)); // medianoche MX = 06:00 UTC
  return { inicio: inicioUTC.toISOString(), fin: now.toISOString(), fecha };
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// Busca un modificador por categoría (flexible ante variaciones de nombre)
function getModificador(lineModifiers, palabrasClave) {
  for (const mod of (lineModifiers || [])) {
    const cat = (mod.modifier_set_name || mod.name || '').toLowerCase();
    const opt = mod.option || (mod.modifier_set_name ? mod.name : null) || '';
    for (const palabra of palabrasClave) {
      if (cat.includes(palabra)) return opt;
    }
  }
  return null;
}

// Acumula consumo en el mapa: uuid → { raw, nombre, factor, unidad, min }
function acumular(consumo, { uuid, nombre, factor, unidad, min }, rawAmount) {
  if (!uuid || rawAmount <= 0) return;
  if (!consumo[uuid]) consumo[uuid] = { raw: 0, nombre, factor, unidad, min };
  consumo[uuid].raw += rawAmount;
}

// ════════════════════════════════════════════════════════════
// PASO 1: LEER VENTAS DEL DÍA
// ════════════════════════════════════════════════════════════

async function leerVentas({ inicio, fin }) {
  const todos = [];
  let cursor  = null;

  do {
    const params = new URLSearchParams({
      store_id:       STORE_ID,
      created_at_min: inicio,
      created_at_max: fin,
      limit:          '250',
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${API_BASE}/receipts?${params}`, { headers: headers() });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Loyverse receipts ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const pagina = data.receipts ?? [];
    todos.push(...pagina);
    cursor = data.cursor ?? null;
  } while (cursor);

  return todos;
}

// ════════════════════════════════════════════════════════════
// PASO 2: VENTAS → CONSUMO (receta × cantidad, resolviendo leche/té dinámicos)
// ════════════════════════════════════════════════════════════

function procesarVentas(receipts) {
  const consumo    = {};   // uuid → { raw, nombre, factor, unidad, min }
  const bebidasLog = {};   // recetaKey → count
  const sinMapeo   = new Set();

  for (const receipt of receipts) {
    for (const item of (receipt.line_items || [])) {
      const nombre   = (item.item_name || '').toLowerCase().trim();
      const cantidad = item.quantity  || 1;
      const mods     = item.line_modifiers || [];

      const recetaKey = MAPEO_LOWER[nombre];
      if (!recetaKey) {
        sinMapeo.add(nombre);
        continue;
      }

      const receta = RECETAS[recetaKey];
      if (!receta) {
        console.warn(`Receta no encontrada para clave: ${recetaKey}`);
        continue;
      }

      bebidasLog[recetaKey] = (bebidasLog[recetaKey] || 0) + cantidad;

      // Modificadores de leche y té — la receta no fija el ingrediente,
      // solo la cantidad; cuál variante exacta se descuenta depende de lo
      // que el cliente eligió en ese pedido.
      const milkOpt = getModificador(mods, ['leche', 'milk', 'tipo de leche']);
      const teaOpt  = getModificador(mods, ['te', 'té', 'tea', 'tipo de te', 'tipo de té']);
      const milkVar = MILK_VARIANTS[milkOpt] ?? MILK_VARIANTS.default;
      const teaVar  = TEA_VARIANTS[teaOpt]   ?? TEA_VARIANTS.default;

      const esFrappe = mods.some(mod => {
        const cat = (mod.modifier_set_name || '').toLowerCase();
        const opt = (mod.name || '').toLowerCase();
        return cat.includes('frappe') || opt.includes('frappe');
      });

      for (const [ingKey, recipeAmount] of Object.entries(receta)) {
        const raw = recipeAmount * cantidad;

        if (ingKey === 'leche') {
          acumular(consumo, milkVar, raw);
        } else if (ingKey === 'te_verde_negro') {
          acumular(consumo, teaVar, raw);
        } else {
          const ing = INGREDIENTES[ingKey];
          if (ing) acumular(consumo, ing, raw);
        }
      }

      if (esFrappe) {
        acumular(consumo, INGREDIENTES.creamer_non_dairy, 50 * cantidad);
      }
    }
  }

  if (sinMapeo.size > 0) {
    console.warn(`⚠️  Productos sin receta mapeada: ${[...sinMapeo].join(', ')}`);
  }

  return { consumo, bebidasLog };
}

// ════════════════════════════════════════════════════════════
// PASO 3: LEER STOCK ACTUAL DEL POS
// ════════════════════════════════════════════════════════════

async function leerStock() {
  const niveles = [];
  let cursor    = null;

  do {
    const params = new URLSearchParams({ store_id: STORE_ID, limit: '250' });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${API_BASE}/inventory?${params}`, { headers: headers() });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Loyverse inventory GET ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const pagina = data.inventory_levels ?? data.inventory ?? [];
    niveles.push(...pagina);
    cursor = data.cursor ?? null;
  } while (cursor);

  // uuid → in_stock actual
  return Object.fromEntries(
    niveles.map(n => [n.variant_id, n.in_stock ?? 0])
  );
}

// ════════════════════════════════════════════════════════════
// PASO 3b: VARIANTS CON TRACK_STOCK ACTIVO
// ════════════════════════════════════════════════════════════

async function leerVariantsTrackeados() {
  const tracked = new Set();
  let cursor    = null;

  do {
    const url = new URL(`${API_BASE}/items`);
    url.searchParams.set('limit', '250');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Loyverse GET /items ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    for (const item of (data.items ?? [])) {
      if (item.track_stock) {
        for (const v of (item.variants ?? [])) {
          tracked.add(v.variant_id);
        }
      }
    }
    cursor = data.cursor ?? null;
  } while (cursor);

  return tracked;
}

// ════════════════════════════════════════════════════════════
// PASO 4: CALCULAR Y ESCRIBIR EL NUEVO STOCK EN EL POS
// ════════════════════════════════════════════════════════════

async function actualizarStock(consumo, stockActual, trackeados, fecha) {
  const updates  = [];
  const saltados = [];

  for (const [uuid, datos] of Object.entries(consumo)) {
    if (!trackeados.has(uuid)) {
      saltados.push(datos.nombre);
      continue;
    }

    const consumidoPOS = datos.raw * datos.factor;
    const actual = stockActual[uuid] ?? 0;
    const nuevo  = Math.max(0, actual - consumidoPOS);

    updates.push({
      variant_id:  uuid,
      store_id:    STORE_ID,
      stock_after: parseFloat(nuevo.toFixed(4)),
      reason:      `Depletion automatico ${fecha}`,
      // metadata para el reporte y la alerta
      _nombre:     datos.nombre,
      _consumido:  parseFloat(consumidoPOS.toFixed(4)),
      _unidad:     datos.unidad,
      _min:        datos.min,
      _anterior:   actual,
      _nuevo:      parseFloat(nuevo.toFixed(4)),
    });
  }

  const errores = [];

  // Enviar en lotes de LOTE_SIZE
  for (let i = 0; i < updates.length; i += LOTE_SIZE) {
    const lote = updates.slice(i, i + LOTE_SIZE);

    const body = {
      inventory_levels: lote.map(u => ({
        variant_id:  u.variant_id,
        store_id:    u.store_id,
        stock_after: u.stock_after,
        reason:      u.reason,
      })),
    };

    try {
      const res = await fetch(`${API_BASE}/inventory`, {
        method:  'POST',
        headers: headers(),
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        errores.push(`Lote ${i / LOTE_SIZE + 1}: HTTP ${res.status} — ${txt.slice(0, 150)}`);
      }
    } catch (err) {
      errores.push(`Lote ${i / LOTE_SIZE + 1}: ${err.message}`);
    }

    if (i + LOTE_SIZE < updates.length) await delay(LOTE_DELAY);
  }

  if (saltados.length > 0) {
    console.log(`      ⏭️  Saltados (track_stock=false): ${saltados.join(', ')}`);
  }
  if (errores.length > 0) {
    console.error('Errores al actualizar el POS:', errores);
  }

  return { updates, errores };
}

// ════════════════════════════════════════════════════════════
// PASO 5: ALERTA POR WHATSAPP (CallMeBot) CUANDO ALGO CRUZA SU MÍNIMO
// ════════════════════════════════════════════════════════════

export async function enviarWhatsApp(texto) {
  const phone  = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apikey) {
    console.log('ℹ️  CALLMEBOT_PHONE / CALLMEBOT_APIKEY no configurados — skip WhatsApp');
    return;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(apikey)}`;

  try {
    const res  = await fetch(url);
    const body = await res.text();
    console.log(`WhatsApp HTTP ${res.status}: ${body.slice(0, 200)}`);
    if (res.ok) console.log('✓ WhatsApp enviado');
  } catch (err) {
    console.warn('WhatsApp error:', err.message);
  }
}

async function enviarAlerta(criticos, fecha) {
  if (criticos.length === 0) return;

  const texto = [
    `⚠️ Inventario — ${criticos.length} ingrediente${criticos.length > 1 ? 's' : ''} crítico${criticos.length > 1 ? 's' : ''} hoy ${fecha}:`,
    ...criticos.map(c => `- ${c._nombre}: ${c._nuevo} ${c._unidad} restante`),
  ].join('\n');

  await enviarWhatsApp(texto);
}

// ════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ════════════════════════════════════════════════════════════

export async function correrDepletion() {
  const { inicio, fin, fecha } = getHoyMexicoCity();
  console.log(`\n🚀 Depletion ${fecha} | ventas de ${inicio} a ${fin}`);

  console.log('  1/5 Leyendo ventas del día...');
  const receipts = await leerVentas({ inicio, fin });
  console.log(`      ${receipts.length} recibos encontrados`);

  console.log('  2/5 Procesando ventas → consumo...');
  const { consumo, bebidasLog } = procesarVentas(receipts);
  const totalBebidas = Object.values(bebidasLog).reduce((a, b) => a + b, 0);
  console.log(`      ${totalBebidas} bebidas · ${Object.keys(consumo).length} ingredientes afectados`);

  if (Object.keys(consumo).length === 0) {
    console.log('  Sin consumo que reportar. Depletion terminado.\n');
    return { receipts: receipts.length, bebidas: 0, updates: 0, criticos: 0 };
  }

  console.log('  3/5 Leyendo stock actual del POS...');
  const [stockActual, trackeados] = await Promise.all([leerStock(), leerVariantsTrackeados()]);

  console.log('  4/5 Calculando y actualizando stock...');
  const { updates, errores } = await actualizarStock(consumo, stockActual, trackeados, fecha);
  console.log(`      ${updates.length} updates enviados · ${errores.length} errores`);

  const criticos = updates.filter(u => u._nuevo < u._min && u._min > 0);
  console.log(`  5/5 Verificando críticos (${criticos.length})...`);
  if (criticos.length > 0) await enviarAlerta(criticos, fecha);

  console.log(`\n✅ Depletion completado. Críticos: ${criticos.length}\n`);
  return {
    receipts:   receipts.length,
    bebidas:    totalBebidas,
    bebidasLog,
    updates:    updates.length,
    errores:    errores.length,
    criticos:   criticos.length,
    criticos_detalle: criticos.map(c => ({ nombre: c._nombre, stock: c._nuevo, min: c._min, unidad: c._unidad })),
  };
}
