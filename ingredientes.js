// Catálogo de ejemplo — nombres, UUIDs y umbrales son ficticios, no los del
// negocio real. La estructura (uuid de variante en el POS, factor de
// conversión, unidad, mínimo crítico) sí es la real.
//
// factor convierte unidades de receta → unidades de inventario en el POS:
//   Polvos/jams:  gramos → Kilos   (÷ 1000)
//   Leche/té:     ml     → Cajas   (÷ 1000)
//   Desechables:  pieza  → pieza   (× 1)

export const INGREDIENTES = {
  // ── POLVOS ──────────────────────────────────────────────
  powder_taro:    { uuid: '11111111-0000-4000-8000-000000000001', nombre: 'Taro Powder',    factor: 1 / 1000, unidad: 'Kilo', min: 2 },
  powder_matcha:  { uuid: '11111111-0000-4000-8000-000000000002', nombre: 'Matcha Powder',  factor: 1 / 1000, unidad: 'Kilo', min: 2 },

  // ── JAMS ────────────────────────────────────────────────
  jam_strawberry: { uuid: '11111111-0000-4000-8000-000000000003', nombre: 'Strawberry Jam', factor: 1 / 1000, unidad: 'Kilo', min: 2 },
  jam_mango:      { uuid: '11111111-0000-4000-8000-000000000004', nombre: 'Mango Jam',      factor: 1 / 1000, unidad: 'Kilo', min: 2 },

  // ── AZÚCARES / JARABES ────────────────────────────────────
  syrup_sugar:      { uuid: '11111111-0000-4000-8000-000000000005', nombre: 'Sugar Syrup',       factor: 1 / 1000, unidad: 'Kilo', min: 4 },
  creamer_non_dairy:{ uuid: '11111111-0000-4000-8000-000000000006', nombre: 'Non-Dairy Creamer', factor: 1 / 1000, unidad: 'Kilo', min: 2 },

  // ── DESECHABLES ───────────────────────────────────────────
  cup:  { uuid: '11111111-0000-4000-8000-000000000007', nombre: 'Cups',   factor: 1, unidad: 'Box', min: 1 },
  lid:  { uuid: '11111111-0000-4000-8000-000000000008', nombre: 'Lids',   factor: 1, unidad: 'Box', min: 1 },
  straw:{ uuid: '11111111-0000-4000-8000-000000000009', nombre: 'Straws', factor: 1, unidad: 'Box', min: 1 },
};

// Variantes de leche: resueltas dinámicamente por el modificador que el
// cliente eligió en el pedido, no por una clave fija en la receta.
export const MILK_VARIANTS = {
  'Oat':     { uuid: '11111111-0000-4000-8000-000000000010', nombre: 'Oat Milk',     factor: 1 / 1000, unidad: 'Caja', min: 2 },
  'Almond':  { uuid: '11111111-0000-4000-8000-000000000011', nombre: 'Almond Milk',  factor: 1 / 1000, unidad: 'Caja', min: 2 },
  'Lactose-Free': { uuid: '11111111-0000-4000-8000-000000000012', nombre: 'Lactose-Free Milk', factor: 1 / 1000, unidad: 'Caja', min: 2 },
  default:   { uuid: '11111111-0000-4000-8000-000000000012', nombre: 'Lactose-Free Milk', factor: 1 / 1000, unidad: 'Caja', min: 2 },
};

// Variantes de té: mismo mecanismo que la leche.
export const TEA_VARIANTS = {
  'Black tea': { uuid: '11111111-0000-4000-8000-000000000013', nombre: 'Black Tea', factor: 1 / 1000, unidad: 'Kilo', min: 1 },
  'Green tea': { uuid: '11111111-0000-4000-8000-000000000014', nombre: 'Green Tea', factor: 1 / 1000, unidad: 'Kilo', min: 1 },
  default:     { uuid: '11111111-0000-4000-8000-000000000013', nombre: 'Black Tea', factor: 1 / 1000, unidad: 'Kilo', min: 1 },
};
