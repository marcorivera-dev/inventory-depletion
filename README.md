# inventory-depletion

*Versión en español: [README.es.md](README.es.md)*

Automatically deducts ingredient inventory every night, based on that day's sales in Loyverse (POS)
— and warns over WhatsApp before something runs out, not after.

> Extracted from a larger inventory system (orders, kitchen, payments, loyalty). This repo only
> carries the depletion piece: the recipe → ingredient model, the nightly scheduler, and the
> critical-level alert. The recipe and ingredient catalog in `recipes.js` / `ingredients.js` is a
> sample — not the real menu, ingredients, suppliers, costs, or formulation quantities of the
> actual business.

## The case

I counted physical stock by hand every day — 30 minutes a day, about 15 hours a month. Despite that,
we still ran out of an ingredient roughly four times a month, and I over-ordered everything else as a
hedge against it.

What I asked first: what's the real unit of consumption? Sales in the POS are products, but the stock
that runs out is ingredients — the link between them is the recipe, so that's what had to be modeled,
not the sales themselves. And a recipe doesn't always fix the ingredient: if a customer orders their
drink with oat milk instead of the default, the recipe says "milk," but what actually needs to be
deducted is oat milk — that's resolved against the order's real modifier, not a fixed value (see
`processSales` in `depletion.js`).

Every night, the scheduler runs `runDepletion()`: it pulls the day's sales from the Loyverse API,
decomposes each product sold into its ingredients according to its recipe, deducts the corresponding
stock directly in the POS, and sends a WhatsApp alert (via CallMeBot) when any ingredient crosses its
critical threshold — before the shortage, not after a customer already ordered something that wasn't
there.

**Impact:** ~15 hours a month back from the daily count. Stockouts — around four a month before this,
each one a lost sale — are now pre-empted by the alert instead of discovered at the counter.

**What it can't do:** computed stock drifts from physical stock, because spillage and waste never
appear in sales data — an ingredient that gets thrown out doesn't deduct itself. The process replaces
the daily count, not the periodic one: a physical recount every few weeks is still needed to re-anchor
the numbers. Treating the computed figure as ground truth would quietly rot the whole system.

## How it fits together

```
scheduler.js         starts the nightly cron (and an hourly heartbeat)
  └─ depletion.js     orchestrates runDepletion(): sales → consumption → stock → alert
       ├─ recipes.js      recipe = ingredient → quantity (sample)
       ├─ item-map.js     POS item name → recipe key (sample)
       └─ ingredients.js  ingredient → POS variant uuid, factor, minimum (sample)
```

`milk` and `tea` are special keys inside a recipe: instead of pointing to a fixed ingredient,
`depletion.js` resolves them against the modifier carried on the order (`MILK_VARIANTS` /
`TEA_VARIANTS` in `ingredients.js`).

## Local setup

```bash
npm install
cp .env.example .env
```

| Variable | What it's for |
|---|---|
| `LOYVERSE_TOKEN` | Authenticates against the Loyverse API (sales, inventory, catalog) |
| `LOYVERSE_STORE_ID` | ID of the Loyverse store whose inventory gets depleted |
| `CALLMEBOT_PHONE` | WhatsApp destination number for the critical-level alert |
| `CALLMEBOT_APIKEY` | CallMeBot key to send the message |

```bash
npm start              # starts the scheduler (nightly cron + heartbeat)
npm run depletion      # runs a single depletion, without waiting for the cron
```

Without `CALLMEBOT_PHONE`/`CALLMEBOT_APIKEY` configured, depletion still runs — it just skips the
WhatsApp step and says so in the log.
