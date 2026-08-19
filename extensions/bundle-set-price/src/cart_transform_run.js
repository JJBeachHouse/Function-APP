// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * Fixed-price bundles for the theme's bundle builder.
 *
 * The bundle-builder section adds each chosen product as its own cart line so
 * Shopify tracks component inventory normally, and stamps three hidden line
 * properties on every line of a bundle:
 *
 *   _bundle_id     unique per bundle added to the cart (groups the lines)
 *   _bundle_total  the fixed price for the whole bundle, in CENTS
 *   _bundle_size   how many lines the bundle should have (optional)
 *
 * This function groups the lines by _bundle_id and rewrites each line's price so
 * the group sums exactly to _bundle_total. Because it uses the update operation
 * rather than a discount, the customer sees the bundle prices directly and no
 * discount line appears at checkout.
 *
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const groups = new Map();

  for (const line of input.cart.lines) {
    const bundleId = line.bundleId?.value;
    const totalCents = toInt(line.bundleTotal?.value);

    // No bundle stamp, or no set price configured → leave the line alone.
    if (!bundleId || totalCents === null || totalCents <= 0) continue;

    let group = groups.get(bundleId);
    if (!group) {
      group = { totalCents, size: toInt(line.bundleSize?.value), lines: [] };
      groups.set(bundleId, group);
    }
    group.lines.push(line);
  }

  const operations = [];
  for (const group of groups.values()) {
    for (const operation of priceGroup(group)) {
      operations.push(operation);
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}

/**
 * Builds the update operations for one bundle, or returns [] if the bundle
 * isn't intact and should be charged at normal prices instead.
 */
function priceGroup(group) {
  const { lines, totalCents, size } = group;

  // The bundle is incomplete — the customer removed a line in the cart, or
  // merged an existing line. Charging the full bundle price for fewer items
  // would overcharge, so fall back to normal pricing.
  if (size !== null && size > 0 && lines.length !== size) return [];

  // Every bundle line is added with quantity 1. A quantity above that means the
  // customer edited the cart, which the per-unit price maths can't honour
  // exactly, so leave the whole bundle alone.
  if (lines.some((line) => line.quantity !== 1)) return [];

  const lineCents = lines.map((line) =>
    Math.round(parseFloat(line.cost.amountPerQuantity.amount) * 100)
  );
  if (lineCents.some((cents) => !Number.isFinite(cents) || cents < 0)) return [];

  const originalCents = lineCents.reduce((sum, cents) => sum + cents, 0);
  if (originalCents <= 0) return [];

  // Split the bundle total across the lines in proportion to what each item
  // normally costs, so a $40 item and a $20 item don't both land on $30. All
  // maths is in integer cents; the last line absorbs the rounding remainder so
  // the group sums to exactly _bundle_total rather than a cent either side.
  const shares = [];
  let allocated = 0;
  for (let i = 0; i < lineCents.length - 1; i++) {
    const share = Math.round((totalCents * lineCents[i]) / originalCents);
    shares.push(share);
    allocated += share;
  }
  shares.push(totalCents - allocated);

  // Proportional rounding can only go negative on pathological inputs (a zero
  // priced item alongside a tiny bundle total). Split evenly instead.
  if (shares.some((share) => share < 0)) {
    const even = Math.floor(totalCents / lines.length);
    shares.length = 0;
    for (let i = 0; i < lines.length - 1; i++) shares.push(even);
    shares.push(totalCents - even * (lines.length - 1));
  }

  return lines.map((line, i) => ({
    update: {
      cartLineId: line.id,
      price: {
        adjustment: {
          fixedPricePerUnit: {
            // Decimal in presentment currency, not cents.
            amount: (shares[i] / 100).toFixed(2),
          },
        },
      },
    },
  }));
}

/**
 * Parses an integer line property, returning null when absent or malformed.
 */
function toInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
