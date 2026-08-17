import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { RECIPES } from './recipes.js';
import { ITEM_MAP } from './item-map.js';
import { INGREDIENTS, MILK_VARIANTS, TEA_VARIANTS } from './ingredients.js';

const ITEM_MAP_LOWER = Object.fromEntries(
  Object.entries(ITEM_MAP).map(([k, v]) => [k.toLowerCase().trim(), v])
);

const STORE_ID   = process.env.LOYVERSE_STORE_ID;
const API_BASE   = 'https://api.loyverse.com/v1.0';
const BATCH_SIZE  = 20;   // items per batch sent to the POS
const BATCH_DELAY = 500;  // ms between batches

const headers = () => ({
  Authorization: `Bearer ${process.env.LOYVERSE_TOKEN}`,
  'Content-Type': 'application/json',
});

// ════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════

function getTodayMexicoCity() {
  const now  = new Date();
  // Mexico City is permanently UTC-6 since 2023 (no DST)
  const date = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const [y, m, d] = date.split('-').map(Number);
  const startUTC = new Date(Date.UTC(y, m - 1, d, 6, 0, 0)); // midnight MX = 06:00 UTC
  return { start: startUTC.toISOString(), end: now.toISOString(), date };
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// Looks up a modifier by category (flexible against naming variations)
function getModifier(lineModifiers, keywords) {
  for (const mod of (lineModifiers || [])) {
    const cat = (mod.modifier_set_name || mod.name || '').toLowerCase();
    const opt = mod.option || (mod.modifier_set_name ? mod.name : null) || '';
    for (const keyword of keywords) {
      if (cat.includes(keyword)) return opt;
    }
  }
  return null;
}

// Accumulates consumption in the map: uuid -> { raw, name, factor, unit, min }
function accumulate(consumption, { uuid, name, factor, unit, min }, rawAmount) {
  if (!uuid || rawAmount <= 0) return;
  if (!consumption[uuid]) consumption[uuid] = { raw: 0, name, factor, unit, min };
  consumption[uuid].raw += rawAmount;
}

// ════════════════════════════════════════════════════════════
// STEP 1: READ TODAY'S SALES
// ════════════════════════════════════════════════════════════

async function getDailySales({ start, end }) {
  const all = [];
  let cursor  = null;

  do {
    const params = new URLSearchParams({
      store_id:       STORE_ID,
      created_at_min: start,
      created_at_max: end,
      limit:          '250',
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${API_BASE}/receipts?${params}`, { headers: headers() });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Loyverse receipts ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const page = data.receipts ?? [];
    all.push(...page);
    cursor = data.cursor ?? null;
  } while (cursor);

  return all;
}

// ════════════════════════════════════════════════════════════
// STEP 2: SALES -> CONSUMPTION (recipe × quantity, resolving dynamic milk/tea)
// ════════════════════════════════════════════════════════════

function processSales(receipts) {
  const consumption = {};   // uuid -> { raw, name, factor, unit, min }
  const drinksLog    = {};  // recipeKey -> count
  const unmapped     = new Set();

  for (const receipt of receipts) {
    for (const item of (receipt.line_items || [])) {
      const name     = (item.item_name || '').toLowerCase().trim();
      const quantity = item.quantity  || 1;
      const mods     = item.line_modifiers || [];

      const recipeKey = ITEM_MAP_LOWER[name];
      if (!recipeKey) {
        unmapped.add(name);
        continue;
      }

      const recipe = RECIPES[recipeKey];
      if (!recipe) {
        console.warn(`No recipe found for key: ${recipeKey}`);
        continue;
      }

      drinksLog[recipeKey] = (drinksLog[recipeKey] || 0) + quantity;

      // Milk and tea modifiers — the recipe doesn't fix the ingredient,
      // only the amount; which exact variant gets deducted depends on
      // what the customer chose on that order. Keywords are checked in
      // both English and Spanish since a real POS catalog is rarely
      // consistently in one language.
      const milkOpt = getModifier(mods, ['milk', 'leche', 'tipo de leche']);
      const teaOpt  = getModifier(mods, ['tea', 'te', 'té', 'tipo de te', 'tipo de té']);
      const milkVar = MILK_VARIANTS[milkOpt] ?? MILK_VARIANTS.default;
      const teaVar  = TEA_VARIANTS[teaOpt]   ?? TEA_VARIANTS.default;

      const isFrappe = mods.some(mod => {
        const cat = (mod.modifier_set_name || '').toLowerCase();
        const opt = (mod.name || '').toLowerCase();
        return cat.includes('frappe') || opt.includes('frappe');
      });

      for (const [ingKey, recipeAmount] of Object.entries(recipe)) {
        const raw = recipeAmount * quantity;

        if (ingKey === 'milk') {
          accumulate(consumption, milkVar, raw);
        } else if (ingKey === 'tea') {
          accumulate(consumption, teaVar, raw);
        } else {
          const ing = INGREDIENTS[ingKey];
          if (ing) accumulate(consumption, ing, raw);
        }
      }

      if (isFrappe) {
        accumulate(consumption, INGREDIENTS.creamer_non_dairy, 50 * quantity);
      }
    }
  }

  if (unmapped.size > 0) {
    console.warn(`⚠️  Items with no mapped recipe: ${[...unmapped].join(', ')}`);
  }

  return { consumption, drinksLog };
}

// ════════════════════════════════════════════════════════════
// STEP 3: READ CURRENT STOCK FROM THE POS
// ════════════════════════════════════════════════════════════

async function getCurrentStock() {
  const levels = [];
  let cursor   = null;

  do {
    const params = new URLSearchParams({ store_id: STORE_ID, limit: '250' });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`${API_BASE}/inventory?${params}`, { headers: headers() });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Loyverse inventory GET ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const page = data.inventory_levels ?? data.inventory ?? [];
    levels.push(...page);
    cursor = data.cursor ?? null;
  } while (cursor);

  // uuid -> current in_stock
  return Object.fromEntries(
    levels.map(n => [n.variant_id, n.in_stock ?? 0])
  );
}

// ════════════════════════════════════════════════════════════
// STEP 3b: VARIANTS WITH TRACK_STOCK ENABLED
// ════════════════════════════════════════════════════════════

async function getTrackedVariants() {
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
// STEP 4: COMPUTE AND WRITE THE NEW STOCK BACK TO THE POS
// ════════════════════════════════════════════════════════════

async function updateStock(consumption, currentStock, tracked, date) {
  const updates = [];
  const skipped  = [];

  for (const [uuid, data] of Object.entries(consumption)) {
    if (!tracked.has(uuid)) {
      skipped.push(data.name);
      continue;
    }

    const consumed = data.raw * data.factor;
    const current = currentStock[uuid] ?? 0;
    const updated = Math.max(0, current - consumed);

    updates.push({
      variant_id:  uuid,
      store_id:    STORE_ID,
      stock_after: parseFloat(updated.toFixed(4)),
      reason:      `Automatic depletion ${date}`,
      // metadata for the report and the alert
      _name:      data.name,
      _consumed:  parseFloat(consumed.toFixed(4)),
      _unit:      data.unit,
      _min:       data.min,
      _before:    current,
      _after:     parseFloat(updated.toFixed(4)),
    });
  }

  const errors = [];

  // Send in batches of BATCH_SIZE
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    const body = {
      inventory_levels: batch.map(u => ({
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
        errors.push(`Batch ${i / BATCH_SIZE + 1}: HTTP ${res.status} — ${txt.slice(0, 150)}`);
      }
    } catch (err) {
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${err.message}`);
    }

    if (i + BATCH_SIZE < updates.length) await delay(BATCH_DELAY);
  }

  if (skipped.length > 0) {
    console.log(`      ⏭️  Skipped (track_stock=false): ${skipped.join(', ')}`);
  }
  if (errors.length > 0) {
    console.error('Errors updating the POS:', errors);
  }

  return { updates, errors };
}

// ════════════════════════════════════════════════════════════
// STEP 5: WHATSAPP ALERT (CallMeBot) WHEN SOMETHING CROSSES ITS MINIMUM
// ════════════════════════════════════════════════════════════

export async function sendWhatsApp(text) {
  const phone  = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apikey) {
    console.log('ℹ️  CALLMEBOT_PHONE / CALLMEBOT_APIKEY not configured — skipping WhatsApp');
    return;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;

  try {
    const res  = await fetch(url);
    const body = await res.text();
    console.log(`WhatsApp HTTP ${res.status}: ${body.slice(0, 200)}`);
    if (res.ok) console.log('✓ WhatsApp sent');
  } catch (err) {
    console.warn('WhatsApp error:', err.message);
  }
}

async function sendCriticalAlert(critical, date) {
  if (critical.length === 0) return;

  const text = [
    `⚠️ Inventory — ${critical.length} critical ingredient${critical.length > 1 ? 's' : ''} today ${date}:`,
    ...critical.map(c => `- ${c._name}: ${c._after} ${c._unit} left`),
  ].join('\n');

  await sendWhatsApp(text);
}

// ════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ════════════════════════════════════════════════════════════

export async function runDepletion() {
  const { start, end, date } = getTodayMexicoCity();
  console.log(`\n🚀 Depletion ${date} | sales from ${start} to ${end}`);

  console.log('  1/5 Reading today\'s sales...');
  const receipts = await getDailySales({ start, end });
  console.log(`      ${receipts.length} receipts found`);

  console.log('  2/5 Processing sales -> consumption...');
  const { consumption, drinksLog } = processSales(receipts);
  const totalDrinks = Object.values(drinksLog).reduce((a, b) => a + b, 0);
  console.log(`      ${totalDrinks} drinks · ${Object.keys(consumption).length} ingredients affected`);

  if (Object.keys(consumption).length === 0) {
    console.log('  Nothing to report. Depletion done.\n');
    return { receipts: receipts.length, drinks: 0, updates: 0, critical: 0 };
  }

  console.log('  3/5 Reading current stock from the POS...');
  const [currentStock, tracked] = await Promise.all([getCurrentStock(), getTrackedVariants()]);

  console.log('  4/5 Computing and updating stock...');
  const { updates, errors } = await updateStock(consumption, currentStock, tracked, date);
  console.log(`      ${updates.length} updates sent · ${errors.length} errors`);

  const critical = updates.filter(u => u._after < u._min && u._min > 0);
  console.log(`  5/5 Checking critical levels (${critical.length})...`);
  if (critical.length > 0) await sendCriticalAlert(critical, date);

  console.log(`\n✅ Depletion complete. Critical: ${critical.length}\n`);
  return {
    receipts:   receipts.length,
    drinks:     totalDrinks,
    drinksLog,
    updates:    updates.length,
    errors:     errors.length,
    critical:   critical.length,
    criticalDetail: critical.map(c => ({ name: c._name, stock: c._after, min: c._min, unit: c._unit })),
  };
}
