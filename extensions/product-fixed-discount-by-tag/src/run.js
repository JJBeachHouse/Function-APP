// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 * @typedef {import("../generated/api").Discount} Discount
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const discounts = [];

  input.cart.lines.forEach((line) => {
    const variant = line.merchandise;
    if (!variant?.product?.hasAnyTag || !variant.product.hasTags) {
      return;  
    }
 
    const fixedPriceTag = variant.product.hasTags.find((tagObj) =>
      tagObj.tag.includes("pattern-discounted-price") &&  tagObj.hasTag==true
    );

    if (!fixedPriceTag) {
      return;  
    }
 
    const match = fixedPriceTag.tag.match(/^(\d+\.\d{2})/);
    if (!match) {
      return;  
    }
    
    const fixedPrice = (parseFloat(match[1]) * 100);  
    
    const originalPrice = (line.cost?.amountPerQuantity.amount * 100);  

    if (originalPrice <= fixedPrice) {
      return;  
    }

    
    const discountAmount = originalPrice - fixedPrice;  
    
    discounts.push({
      value: {
        fixedAmount: {
          amount: discountAmount / 100,  
          appliesToEachItem: true 
        },
      },
      targets: [
        {
          productVariant: {
            id: variant.id,
          },
        },
      ],
      message:`Get only for $${(fixedPrice / 100).toFixed(2)}`
    });
  });
  console.log(JSON.stringify(discounts)) 
  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
