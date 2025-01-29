/**
 * @typedef {import("../generated/api").Input} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: "FIRST",
  discounts: [],
};

/**
 * Main function to process the discount based on spend thresholds.
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
 

  const eligibleLines = [];
  for (const line of input.cart.lines) {
    if (line.freeGift != null || line.gwpType != null || line.giftId != null) {
      eligibleLines.push({
        productVariant: {
          id: line.merchandise.id,
          quantity:1
        },
      });
    }
  }

  // Create discount value
  const discountValue = {
    percentage: { value: 100 },
  };

  if (eligibleLines.length == 0) {
    console.log("no eligible lines");
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets: eligibleLines.map((line) => ({
          productVariant: line.productVariant,
        })),
        message: `Free Gift`,
        value: discountValue,
      },
    ],
    discountApplicationStrategy: "FIRST",
  };
}


