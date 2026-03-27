import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from '../generated/api';

function parseNumber(value) {
  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Invalid Paystone JSON attribute', error);
    return null;
  }
}

function getLockedTransaction(input) {
  const lockData = parseJson(input?.cart?.lock?.value);

  if (!lockData || Number(lockData.status) !== 1) {
    return null;
  }

  const amount = parseNumber(lockData.amt);
  if (amount <= 0) {
    return null;
  }

  return {
    amount,
    cid: lockData.cid || '',
    voucherCode: lockData.voucherCode || '',
  };
}

function getDiscountContext(input) {
  const lockedTransaction = getLockedTransaction(input);
  if (lockedTransaction) {
    return lockedTransaction;
  }

  const balance = parseNumber(input?.cart?.balance?.value);
  if (balance <= 0) {
    return null;
  }

  const config = parseJson(input?.cart?.config?.value);

  return {
    amount: balance,
    cid: config?.cid || '',
    voucherCode: config?.voucherCode || '',
  };
}

export function cartLinesDiscountsGenerateRun(input) {
  if (!input?.discount?.discountClasses?.includes(DiscountClass.Order)) {
    return {operations: []};
  }

  const context = getDiscountContext(input);
  if (!context) {
    return {operations: []};
  }

  const cartTotal = parseNumber(input?.cart?.cost?.totalAmount?.amount);
  const discountAmount = Math.min(context.amount, cartTotal);

  if (discountAmount <= 0) {
    return {operations: []};
  }

  const identifier = context.voucherCode || context.cid;
  const message = identifier
    ? `Voucher Applied (${identifier})`
    : 'Voucher Applied';

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message,
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
          selectionStrategy: OrderDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
