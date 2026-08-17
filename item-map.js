// Exact item name in the POS -> recipe key in recipes.js.
// In the real system this table has dozens of entries (name variants,
// accents, capitalization) to tolerate however each item ended up
// captured at the point of sale; here there are only 4, one per sample
// recipe.
export const ITEM_MAP = {
  'Taro Milk Tea':        'TARO_MILK_TEA',
  'Matcha Milk Tea':      'MATCHA_MILK_TEA',
  'Strawberry Fruit Tea': 'STRAWBERRY_FRUIT_TEA',
  'Mango Fruit Tea':      'MANGO_FRUIT_TEA',
};
