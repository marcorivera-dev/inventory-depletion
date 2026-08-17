// Catálogo de ejemplo — estas no son las bebidas reales del negocio, son un
// menú ficticio que ilustra el mismo patrón: cada receta es un mapa
// ingrediente → cantidad (gramos, ml o piezas, según el ingrediente).
//
// 'leche' y 'te_verde_negro' son claves especiales: depletion.js las
// resuelve en tiempo de ejecución contra el modificador que el cliente
// eligió (ver MILK_VARIANTS / TEA_VARIANTS en ingredientes.js), no contra
// un ingrediente fijo — la misma receta de "Taro Milk Tea" consume leche de
// avena o deslactosada según lo que pidió el cliente ese día.

export const RECETAS = {
  TARO_MILK_TEA: {
    powder_taro: 50,
    leche: 250,
    cup: 1,
    lid: 1,
    straw: 1,
  },
  MATCHA_MILK_TEA: {
    powder_matcha: 50,
    leche: 250,
    cup: 1,
    lid: 1,
    straw: 1,
  },
  STRAWBERRY_FRUIT_TEA: {
    te_verde_negro: 300,
    jam_strawberry: 50,
    syrup_sugar: 25,
    cup: 1,
    lid: 1,
    straw: 1,
  },
  MANGO_FRUIT_TEA: {
    te_verde_negro: 300,
    jam_mango: 50,
    syrup_sugar: 25,
    cup: 1,
    lid: 1,
    straw: 1,
  },
};

export default RECETAS;
