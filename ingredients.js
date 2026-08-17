// Sample catalog — names, UUIDs and thresholds are fictional, not the real
// business's. The structure (POS variant uuid, conversion factor, unit,
// critical minimum) is the real one.
//
// factor converts recipe units -> inventory units in the POS:
//   Powders/jams:   grams -> Kilos  (÷ 1000)
//   Milk/tea:       ml    -> Boxes  (÷ 1000)
//   Disposables:    piece -> piece  (× 1)

export const INGREDIENTS = {
  // ── POWDERS ─────────────────────────────────────────────
  powder_taro:    { uuid: '11111111-0000-4000-8000-000000000001', name: 'Taro Powder',    factor: 1 / 1000, unit: 'Kilo', min: 3 },
  powder_matcha:  { uuid: '11111111-0000-4000-8000-000000000002', name: 'Matcha Powder',  factor: 1 / 1000, unit: 'Kilo', min: 2.5 },

  // ── JAMS ────────────────────────────────────────────────
  jam_strawberry: { uuid: '11111111-0000-4000-8000-000000000003', name: 'Strawberry Jam', factor: 1 / 1000, unit: 'Kilo', min: 1.5 },
  jam_mango:      { uuid: '11111111-0000-4000-8000-000000000004', name: 'Mango Jam',      factor: 1 / 1000, unit: 'Kilo', min: 3 },

  // ── SUGAR / SYRUPS ──────────────────────────────────────
  syrup_sugar:      { uuid: '11111111-0000-4000-8000-000000000005', name: 'Sugar Syrup',       factor: 1 / 1000, unit: 'Kilo', min: 5 },
  creamer_non_dairy:{ uuid: '11111111-0000-4000-8000-000000000006', name: 'Non-Dairy Creamer', factor: 1 / 1000, unit: 'Kilo', min: 3 },

  // ── DISPOSABLES ─────────────────────────────────────────
  cup:  { uuid: '11111111-0000-4000-8000-000000000007', name: 'Cups',   factor: 1, unit: 'Box', min: 2 },
  lid:  { uuid: '11111111-0000-4000-8000-000000000008', name: 'Lids',   factor: 1, unit: 'Box', min: 2 },
  straw:{ uuid: '11111111-0000-4000-8000-000000000009', name: 'Straws', factor: 1, unit: 'Box', min: 2 },
};

// Milk variants: resolved dynamically from the modifier the customer chose
// on the order, not from a fixed key in the recipe.
export const MILK_VARIANTS = {
  'Oat':     { uuid: '11111111-0000-4000-8000-000000000010', name: 'Oat Milk',     factor: 1 / 1000, unit: 'Box', min: 3 },
  'Almond':  { uuid: '11111111-0000-4000-8000-000000000011', name: 'Almond Milk',  factor: 1 / 1000, unit: 'Box', min: 3 },
  'Lactose-Free': { uuid: '11111111-0000-4000-8000-000000000012', name: 'Lactose-Free Milk', factor: 1 / 1000, unit: 'Box', min: 3 },
  default:   { uuid: '11111111-0000-4000-8000-000000000012', name: 'Lactose-Free Milk', factor: 1 / 1000, unit: 'Box', min: 3 },
};

// Tea variants: same mechanism as milk.
export const TEA_VARIANTS = {
  'Black tea': { uuid: '11111111-0000-4000-8000-000000000013', name: 'Black Tea', factor: 1 / 1000, unit: 'Kilo', min: 2 },
  'Green tea': { uuid: '11111111-0000-4000-8000-000000000014', name: 'Green Tea', factor: 1 / 1000, unit: 'Kilo', min: 2 },
  default:     { uuid: '11111111-0000-4000-8000-000000000013', name: 'Black Tea', factor: 1 / 1000, unit: 'Kilo', min: 2 },
};
