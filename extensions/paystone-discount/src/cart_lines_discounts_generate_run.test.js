import {describe, expect, it} from 'vitest';

import {cartLinesDiscountsGenerateRun} from './cart_lines_discounts_generate_run';
import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from '../generated/api';

describe('cartLinesDiscountsGenerateRun', () => {
  const baseInput = {
    cart: {
      balance: {
        value: null,
      },
      lock: {
        value: null,
      },
      config: {
        value: null,
      },
      cost: {
        totalAmount: {
          amount: 100,
        },
      },
      lines: [
        {
          id: 'gid://shopify/CartLine/0',
        },
      ],
    },
    discount: {
      discountClasses: [],
    },
  };

  it('returns empty operations when order discount class is missing', () => {
    const result = cartLinesDiscountsGenerateRun(baseInput);
    expect(result.operations).toHaveLength(0);
  });

  it('returns empty operations when there is no lock or balance', () => {
    const input = {
      ...baseInput,
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(0);
  });

  it('applies the locked Paystone amount when lock data is present', () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        lock: {
          value: JSON.stringify({
            status: 1,
            amt: '40.50',
            cid: '12345678901234',
            tcr: 'TCR001',
            inv: '987',
          }),
        },
      },
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      orderDiscountsAdd: {
        candidates: [
          {
            message: 'Voucher Applied (12345678901234)',
            targets: [
              {
                orderSubtotal: {
                  excludedCartLineIds: [],
                },
              },
            ],
            value: {
              fixedAmount: {
                amount: 40.5,
              },
            },
          },
        ],
        selectionStrategy: OrderDiscountSelectionStrategy.First,
      },
    });
  });

  it('falls back to the saved balance when lock data is not available', () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        balance: {
          value: '75.00',
        },
        config: {
          value: JSON.stringify({
            voucherCode: 'GC-1001',
          }),
        },
      },
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      orderDiscountsAdd: {
        candidates: [
          {
            message: 'Voucher Applied (GC-1001)',
            value: {
              fixedAmount: {
                amount: 75,
              },
            },
          },
        ],
        selectionStrategy: OrderDiscountSelectionStrategy.First,
      },
    });
  });

  it('caps the discount at the cart total', () => {
    const input = {
      ...baseInput,
      cart: {
        ...baseInput.cart,
        balance: {
          value: '250',
        },
      },
      discount: {
        discountClasses: [DiscountClass.Order],
      },
    };

    const result = cartLinesDiscountsGenerateRun(input);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      orderDiscountsAdd: {
        candidates: [
          {
            message: 'Voucher Applied',
            value: {
              fixedAmount: {
                amount: 100,
              },
            },
          },
        ],
      },
    });
  });
});
