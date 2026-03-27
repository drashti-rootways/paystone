// import {
//   DiscountClass,
//   OrderDiscountSelectionStrategy,
//   ProductDiscountSelectionStrategy,
// } from '../generated/api';


// /**
//   * @typedef {import("../generated/api").CartInput} RunInput
//   * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
//   */

// /**
//   * @param {RunInput} input
//   * @returns {CartLinesDiscountsGenerateRunResult}
//   */

// export function cartLinesDiscountsGenerateRun(input) {
//   if (!input.cart.lines.length) {
//     throw new Error('No cart lines found');
//   }

//   const hasOrderDiscountClass = input.discount.discountClasses.includes(
//     DiscountClass.Order,
//   );
//   const hasProductDiscountClass = input.discount.discountClasses.includes(
//     DiscountClass.Product,
//   );

//   if (!hasOrderDiscountClass && !hasProductDiscountClass) {
//     return {operations: []};
//   }

//   const maxCartLine = input.cart.lines.reduce((maxLine, line) => {
//     if (Number.parseFloat(line.cost.subtotalAmount.amount) > Number.parseFloat(maxLine.cost.subtotalAmount.amount)) {
//       return line;
//     }
//     return maxLine;
//   }, input.cart.lines[0]);

//   const operations = [];

//   if (hasOrderDiscountClass) {
//     operations.push({
//       orderDiscountsAdd: {
//         candidates: [
//           {
//             message: '10% OFF ORDER',
//             targets: [
//               {
//                 orderSubtotal: {
//                   excludedCartLineIds: [],
//                 },
//               },
//             ],
//             value: {
//               percentage: {
//                 value: 10,
//               },
//             },
//           },
//         ],
//         selectionStrategy: OrderDiscountSelectionStrategy.First,
//       },
//     });
//   }

//   if (hasProductDiscountClass) {
//     operations.push({
//       productDiscountsAdd: {
//         candidates: [
//           {
//             message: '20% OFF PRODUCT',
//             targets: [
//               {
//                 cartLine: {
//                   id: maxCartLine.id,
//                 },
//               },
//             ],
//             value: {
//               percentage: {
//                 value: 20,
//               },
//             },
//           },
//         ],
//         selectionStrategy: ProductDiscountSelectionStrategy.First,
//       },
//     });
//   }

//   return {
//     operations,
//   };
// }


// import {
//   DiscountClass,
//   OrderDiscountSelectionStrategy,
//   ProductDiscountSelectionStrategy,
// } from '../generated/api';

// /**
//  * @param {import("../generated/api").CartInput} input
//  * @returns {import("../generated/api").CartLinesDiscountsGenerateRunResult}
//  */
// export function cartLinesDiscountsGenerateRun(input) {
//   console.log("STEP 1: cartLinesDiscountsGenerateRun called");

//   // Get voucher from cart attribute
//   const voucherAttr = input?.cart?.attribute?.value;
//   console.log("Voucher attribute:", voucherAttr);

//   // If voucher is empty → remove discount
//   if (!voucherAttr) {
//     console.log("No voucher → removing any discount");
//     return { operations: [] }; // ✅ this removes discount from total
//   }

//   // Only apply discount if voucher matches
//   if (voucherAttr === "12345678901234") {
//     console.log("Valid voucher → applying 50% discount");
//     // ... existing logic to apply order/product discount
//     return {
//       operations: [
//         {
//           orderDiscountsAdd: {
//             candidates: [
//               {
//                 message: "50% OFF Order (Voucher Applied)",
//                 targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
//                 value: { percentage: { value: 50 } },
//               },
//             ],
//             selectionStrategy: OrderDiscountSelectionStrategy.First,
//           },
//         },
//       ],
//     };
//   }

//   console.log("Invalid voucher → remove discount");
//   return { operations: [] }; // ❌ ensures discount is removed if invalid
// }
import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from '../generated/api';

export function cartLinesDiscountsGenerateRun(input) {
  console.log("🔥 FUNCTION TRIGGERED");

  /* =========================
     READ BALANCE ✅
  ========================= */
  let balance = 0;

  try {
    balance = parseFloat(
      input?.cart?.attribute?.value || "0"
    );
  } catch (e) {
    balance = 0;
  }

  console.log("💰 Balance:", balance);

  if (!balance || balance <= 0) {
    console.log("❌ No balance");
    return { operations: [] };
  }

  /* =========================
     CART TOTAL
  ========================= */
  const cartTotal = parseFloat(
    input?.cart?.cost?.totalAmount?.amount || "0"
  );

  console.log("🛒 Cart Total:", cartTotal);

  const discountAmount = Math.min(balance, cartTotal);

  console.log("💸 Discount:", discountAmount);

  /* =========================
     APPLY ORDER DISCOUNT
  ========================= */
  if (
    input.discount.discountClasses.includes(DiscountClass.Order)
  ) {
    return {
      operations: [
        {
          orderDiscountsAdd: {
            candidates: [
              {
                message: `Voucher Applied (₹${discountAmount})`,
                targets: [
                  {
                    orderSubtotal: {
                      excludedCartLineIds: [],
                    },
                  },
                ],
                value: {
                  fixedAmount: {
                    amount: discountAmount,
                  },
                },
              },
            ],
            selectionStrategy:
              OrderDiscountSelectionStrategy.First,
          },
        },
      ],
    };
  }

  return { operations: [] };
}