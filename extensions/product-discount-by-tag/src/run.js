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
  const metafieldValue = input.discountNode?.metafield?.value;

  console.log(JSON.stringify(metafieldValue));
  if (!metafieldValue) {
    console.error("Metafield value is missing or invalid.");
    return EMPTY_DISCOUNT;
  }
  const { tag, amountType, amount, message } = JSON.parse(metafieldValue);

  const eligibleLines = [];
  for (const line of input.cart.lines) {
    if (line.merchandise?.product?.hasAnyTag) {

      let tagText = "" + tag + "";
      if( tagText.includes(':')){
        const variantIdInTag = tagText.split(':');
        let variantIdText =""+ line.merchandise.id + "";
        if(variantIdText.includes(variantIdInTag[1])){
          eligibleLines.push({
            productVariant: {
              id: line.merchandise.id,
            },
          });
        }
      }else{
        eligibleLines.push({
          productVariant: {
            id: line.merchandise.id,
          },
        });
      }


    }
  }

  const discountValue =
    amountType === "percent"
      ? {
          percentage: { value: amount },
        }
      : {
          fixedAmount: {
            amount: amount,
            appliesToEachItem: false,
          },
        };

  if (eligibleLines.length == 0) {
    console.log("no eligible liens");
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets: eligibleLines.map((line) => ({
          productVariant: line.productVariant,
        })),
        message: `${message}`,
        value: discountValue,
      },
    ],
    discountApplicationStrategy: "FIRST",
  };
}
