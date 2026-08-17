# inventory-depletion

*English version: [README.md](README.md)*

Descuenta el inventario de insumos automáticamente, cada noche, a partir de las ventas del día en
Loyverse (POS) — y avisa por WhatsApp antes de que algo se acabe, no después.

> Extraído de un sistema de inventario más grande (pedidos, cocina, pagos, lealtad). Este repo solo
> trae la parte de depleción: el modelo receta → insumo, el scheduler nocturno, y la alerta de nivel
> crítico. El catálogo de recetas e ingredientes en `recipes.js` / `ingredients.js` es de ejemplo —
> no el menú real, ni los insumos, proveedores o costos reales del negocio.

## El caso

Contaba el inventario físico a mano todos los días — 30 minutos diarios, unas 15 horas al mes. Aun
así nos quedábamos sin algún insumo unas cuatro veces al mes, y compraba de más en todo lo demás
como defensa contra eso.

La pregunta que abrió el diseño: ¿cuál es la unidad real de consumo? Las ventas en el POS son
productos, pero el stock que se agota son insumos — lo que une ambos es la receta, así que eso es lo
que había que modelar, no las ventas directamente. Y la receta no siempre fija el ingrediente: si un
cliente pide su bebida con leche de avena en vez de la leche default, la receta dice "leche", pero lo
que hay que descontar es avena — eso se resuelve contra el modificador real del pedido, no contra un
valor fijo (ver `processSales` en `depletion.js`).

Cada noche, el scheduler corre `runDepletion()`: trae las ventas del día por la API de Loyverse,
descompone cada producto vendido en sus insumos según su receta, descuenta el stock correspondiente
directo en el POS, y manda una alerta por WhatsApp (CallMeBot) cuando algún insumo cruza su nivel
crítico — antes del faltante, no después de que un cliente ya pidió algo que no había.

**Impacto:** ~15 horas al mes recuperadas del conteo diario. Los faltantes — antes unos cuatro al
mes, cada uno una venta perdida — ahora se anticipan con la alerta en vez de descubrirse en el
mostrador.

**Lo que no puede hacer:** el stock calculado se desfasa del físico, porque la merma y los derrames
nunca aparecen en los datos de venta — un insumo que se tira no se descuenta solo. El proceso
reemplaza el conteo diario, no el periódico: un recuento físico cada pocas semanas sigue haciendo
falta para volver a anclar los números. Tratar la cifra calculada como verdad absoluta pudriría el
sistema entero en silencio.

## Cómo funciona

```
scheduler.js         arranca el cron nocturno (y un heartbeat cada hora)
  └─ depletion.js     orquesta runDepletion(): ventas → consumo → stock → alerta
       ├─ recipes.js      receta = ingrediente → cantidad (ejemplo)
       ├─ item-map.js     nombre del item en el POS → clave de receta (ejemplo)
       └─ ingredients.js  ingrediente → uuid de variante en el POS, factor, mínimo (ejemplo)
```

`milk` y `tea` son claves especiales dentro de una receta: en vez de apuntar a un ingrediente fijo,
`depletion.js` las resuelve contra el modificador que trae el pedido (`MILK_VARIANTS` / `TEA_VARIANTS`
en `ingredients.js`).

## Setup local

```bash
npm install
cp .env.example .env
```

| Variable | Para qué se usa |
|---|---|
| `LOYVERSE_TOKEN` | Autenticar contra la API de Loyverse (ventas, inventario, catálogo) |
| `LOYVERSE_STORE_ID` | ID de la tienda en Loyverse cuyo inventario se descuenta |
| `CALLMEBOT_PHONE` | Número de WhatsApp destino para la alerta de nivel crítico |
| `CALLMEBOT_APIKEY` | Key de CallMeBot para mandar el mensaje |

```bash
npm start              # arranca el scheduler (cron nocturno + heartbeat)
npm run depletion      # corre un depletion una sola vez, sin esperar al cron
```

Sin `CALLMEBOT_PHONE`/`CALLMEBOT_APIKEY` configurados, el depletion corre igual — solo se salta el
paso de WhatsApp y lo dice en el log.
