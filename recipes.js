// Sample catalog — these aren't the business's real drinks, this is a
// fictional menu illustrating the same pattern: each recipe is a map of
// ingredient -> quantity (grams, ml, or pieces, depending on the
// ingredient).
//
// 'milk' and 'tea' are special keys: depletion.js resolves them at
// runtime against the modifier the customer actually chose (see
// MILK_VARIANTS / TEA_VARIANTS in ingredients.js), not against a fixed
// ingredient — the same "Taro Milk Tea" recipe consumes oat milk or
// lactose-free milk depending on what the customer ordered that day.

export const RECIPES = {
  TARO_MILK_TEA: {
    powder_taro: 50,
    milk: 250,
    cup: 1,
    lid: 1,
    straw: 1,
  },
  MATCHA_MILK_TEA: {
    powder_matcha: 50,
    milk: 250,
    cup: 1,
    lid: 1,
    straw: 1,
  },
  STRAWBERRY_FRUIT_TEA: {
    tea: 300,
    jam_strawberry: 50,
    syrup_sugar: 25,
    cup: 1,
    lid: 1,
    straw: 1,
  },
  MANGO_FRUIT_TEA: {
    tea: 300,
    jam_mango: 50,
    syrup_sugar: 25,
    cup: 1,
    lid: 1,
    straw: 1,
  },
};

export default RECIPES;
