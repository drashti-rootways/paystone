// import '@shopify/ui-extensions/preact';
// import { render } from "preact";
// import { useState } from "preact/hooks";

// export default async () => {
//   render(<Extension />, document.body);
// };

// function Extension() {
//   const [voucher, setVoucher] = useState("");
//   const [error, setError] = useState("");

//   function extractValue(input) {
//     if (typeof input === "string") return input;
//     return input?.value ?? input?.target?.value ?? input?.currentTarget?.value ?? input?.detail?.value ?? "";
//   }

//   if (!shopify.instructions.value.attributes.canUpdateAttributes) {
//     return (
//       <s-banner heading="Paystone Checkout UI" tone="warning">
//         Attribute changes are not supported in this checkout.
//       </s-banner>
//     );
//   }

//   async function handleApply() {
//     if (!voucher.trim()) {
//       setError("Please enter a voucher code.");
//       return;
//     }

//     setError("");

//     const result = await shopify.applyAttributeChange({
//       key: "paystoneGiftVoucher",
//       type: "updateAttribute",
//       value: voucher,
//     });

//     console.log("Voucher Submitted:", voucher);
//     console.log("applyAttributeChange result:", result);
//   }

//   async function handleRemove() {
//     setVoucher(""); // Clear input
//     setError("");

//     // Remove voucher attribute
//     const result = await shopify.applyAttributeChange({
//       key: "paystoneGiftVoucher",
//       type: "updateAttribute",
//       value: "", // empty value → discount function will remove discount
//     });

//     console.log("Voucher Removed");
//     console.log("applyAttributeChange result:", result);
//   }

//   return (
//     <s-banner heading="Paystone Gift Voucher">
//       <s-stack gap="base">
//         <s-text>Enter your Paystone Gift Voucher code to apply a discount.</s-text>

//         <s-text-field
//           label="Voucher Code"
//           value={voucher}
//           onChange={(eventOrValue) => {
//             setError("");
//             setVoucher(extractValue(eventOrValue));
//           }}
//         />

//         {error && <s-text tone="critical">{error}</s-text>}

//         <s-stack direction="inline" gap="base">
//           <s-button onClick={handleApply}>
//             Apply Gift Card
//           </s-button>

//           <s-button onClick={handleRemove} tone="critical">
//             Remove Gift Card
//           </s-button>
//         </s-stack>

//       </s-stack>
//     </s-banner>
//   );
// }

//extensions/checkout-ui/src/Checkout.jsx
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export default async function () {
  render(<Extension />, document.body);
}

function Extension() {
   console.log("PAYSTONE EXTENSION VERSION: V3"); 
  const [voucher, setVoucher] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [pin, setPin] = useState('');
  const shouldShowPin = config?.skipPinVerification === false;

  useEffect(() => {
    if (!voucher.trim()) {
      setConfig(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchPaystoneConfigFromDB(voucher);
    }, 400);

    return () => clearTimeout(timer);
  }, [voucher]);

  function extractValue(input) {
    if (typeof input === 'string') return input;
    return (
      input?.value ||
      input?.target?.value ||
      input?.currentTarget?.value ||
      input?.detail?.value ||
      ''
    );
  }

  function getCheckoutTotalAmount() {
    try {
      const total =
        shopify?.cost?.totalAmount?.value?.amount ??
        shopify?.cost?.totalAmount?.current?.amount ??
        '0';

      const parsed = parseFloat(total || '0');
      console.log('[Paystone] Checkout total amount:', parsed);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch (err) {
      console.error('[Paystone] Failed to read checkout total:', err);
      return 0;
    }
  }

  function getShopDomain() {
    const domain =
      shopify?.shop?.myshopifyDomain ||
      'rootways-plus-demo.myshopify.com';

    console.log('[Paystone] Shop domain:', domain);
    return domain;
  }

  function getSavedLockData() {
    try {
      const attributes =
        shopify?.attributes?.value ||
        shopify?.attributes?.current ||
        [];

      const lockAttribute = attributes.find(
        (attribute) => attribute.key === 'paystoneLock'
      );

      if (!lockAttribute?.value) {
        console.log('[Paystone] No saved paystoneLock attribute found');
        return null;
      }

      const parsed = JSON.parse(lockAttribute.value);
      console.log('[Paystone] Loaded paystoneLock attribute:', parsed);
      return parsed;
    } catch (err) {
      console.error('[Paystone] Failed to parse paystoneLock attribute:', err);
      return null;
    }
  }

  /**
   * 🔹 FETCH DATABASE CONFIG FROM app.paystoneapi-config
   */
async function fetchPaystoneConfigFromDB(voucherCode, pinValue = "") {
  try {
    const shopDomain = getShopDomain();
    const API_BASE = "https://paystone.vercel.app";

    const url =
      `${API_BASE}/app/paystoneapi-config` +
      `?voucher=${encodeURIComponent(voucherCode)}` +
      `&pin=${encodeURIComponent(pinValue)}` +   // ✅ ADD PIN
      `&shop=${encodeURIComponent(shopDomain)}`;

    console.log("[Paystone] Calling API:", url);

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`API failed with status ${res.status}`);
    }

    const data = await res.json();

    console.log("[Paystone] API response:", data);

    setConfig(data.config);

    return data;
  } catch (err) {
    console.error("[Paystone] Error:", err);
    setError("Failed to fetch voucher config.");
    return null;
  }
}

  /**
   * Apply the voucher code and save config to checkout attributes
   */
async function handleApply() {
  if (!voucher.trim()) {
    setError('Please enter a voucher code.');
    return;
  }

  if (!config) {
    setError("Validating voucher... please wait.");
    return;
  }

  if (shouldShowPin && !pin.trim()) {
    setError("Please enter PIN.");
    return;
  }

  setError('');
  setLoading(true);

  try {
    console.log('[Paystone] Apply started', { voucher, hasPin: Boolean(pin) });

    // ✅ STEP 1: Get Paystone URL
    const data = await fetchPaystoneConfigFromDB(voucher, pin);
    if (!data?.success || !data?.paystoneUrl) {
      console.error('[Paystone] Config API failed:', data);
      throw new Error('Paystone config not found');
    }

    const paystoneUrl = data?.paystoneUrl;

    console.log("Final Paystone URL:", paystoneUrl);

    // ✅ STEP 2: CALL MIDDLE API
    const API_BASE = "https://paystone.vercel.app";

    const checkRes = await fetch(
      `${API_BASE}/app/paystone-check?url=${encodeURIComponent(paystoneUrl)}`
    );

    const checkData = await checkRes.json();

    console.log("✅ Paystone Checked Response:", checkData);

   // ✅ Extract BAL from Paystone response
    function extractBalance(raw) {
      const params = new URLSearchParams(raw);
      return parseFloat(params.get("BAL") || "0");
    }

    const balance = extractBalance(checkData.raw);

    console.log("💰 Extracted Balance:", balance);

    // ❌ Invalid voucher
    if (!balance || balance <= 0) {
      await shopify.applyAttributeChange({
        type: "updateAttribute",
        key: "paystoneBalance",
        value: "0",
      });

      await shopify.applyAttributeChange({
        type: "updateAttribute",
        key: "paystoneLock",
        value: "",
      });

      setError("Invalid or empty voucher");
      console.log('[Paystone] Stopping because balance is empty');
      setLoading(false);
      return;
    }

    const checkoutTotal = getCheckoutTotalAmount();
    const lockAmount = Math.min(balance, checkoutTotal);

    console.log('[Paystone] Lock calculation', {
      balance,
      checkoutTotal,
      lockAmount,
    });

    if (!lockAmount || lockAmount <= 0) {
      setError('Unable to calculate lock amount.');
      console.log('[Paystone] Lock amount invalid, stopping');
      setLoading(false);
      return;
    }

    console.log('[Paystone] Starting LOC + CMT request');
    const transactionRes = await fetch(`${API_BASE}/app/paystone-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shop: getShopDomain(),
        voucher,
        pin,
        amount: lockAmount.toFixed(2),
      }),
    });

    const transactionData = await transactionRes.json();
    console.log('[Paystone] LOC + CMT response:', transactionData);
    console.log('[Paystone] Balance after lock:', transactionData?.availableBalance);

    if (!transactionData?.success || !transactionData?.lockData) {
      const message =
        transactionData?.error ||
        `Voucher transaction failed at ${transactionData?.step || 'unknown step'}`;
      console.error('[Paystone] LOC + CMT failed:', message);

      await shopify.applyAttributeChange({
        type: "updateAttribute",
        key: "paystoneLock",
        value: "",
      });

      setError(message);
      setLoading(false);
      return;
    }

    // ✅ SAVE BALANCE (VERY IMPORTANT)
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneBalance",
      value: String(balance),
    });
    console.log('[Paystone] paystoneBalance attribute saved');

    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneLock",
      value: JSON.stringify(transactionData.lockData),
    });
    console.log('[Paystone] paystoneLock attribute saved');

    // (Optional) save voucher info
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneConfig",
      value: JSON.stringify({
        voucherCode: voucher,
        pin,
        cid: voucher,
        balance,
        lockedAmount: transactionData.lockData.amt,
        tcr: transactionData.lockData.tcr,
        inv: transactionData.lockData.inv,
      }),
    });
    console.log('[Paystone] paystoneConfig attribute saved');

   console.log("✅ Balance saved → Triggering cart update");

    // ✅ Trigger Shopify to re-run discount function
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneTrigger",
      value: String(Date.now()), // always new → forces refresh
    });
    console.log('[Paystone] paystoneTrigger updated');

  } catch (err) {
    console.error('[Paystone] handleApply error:', err);
    setError('Failed to apply voucher.');
  } finally {
    setLoading(false);
  }
}

  /**
   * Remove voucher and reset checkout attribute
   */
async function handleRemove() {
  setVoucher('');
  setError('');
  setLoading(true);

  try {
    console.log('[Paystone] Removing voucher and clearing attributes');
    const API_BASE = "https://paystone.vercel.app";
    const lockData = getSavedLockData();

    if (lockData?.cid && lockData?.amt && lockData?.tcr && lockData?.inv) {
      console.log('[Paystone] Starting cancel flow with saved lock data', lockData);

      const unlockRes = await fetch(`${API_BASE}/app/paystone-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel',
          shop: getShopDomain(),
          voucher: lockData.cid,
          pin: lockData.pin || '',
          amount: lockData.amt,
          tcr: lockData.tcr,
          inv: lockData.inv,
        }),
      });

      const unlockData = await unlockRes.json();
      console.log('[Paystone] Cancel response:', unlockData);
      console.log('[Paystone] Balance after remove:', unlockData?.availableBalance);

      if (!unlockData?.success) {
        const message =
          unlockData?.error ||
          `Voucher cancel failed at ${unlockData?.step || 'unknown step'}`;
        console.error('[Paystone] Cancel failed:', message);
        setError(message);
        setLoading(false);
        return;
      }

      console.log('[Paystone] Cancel completed successfully');
    } else {
      console.log('[Paystone] No lock data found, skipping cancel API call');
    }

    // ❌ REMOVE BALANCE (MOST IMPORTANT)
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneBalance",
      value: "0", // or "" both work
    });

    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneLock",
      value: "",
    });

    // (optional) remove config
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneConfig",
      value: "",
    });

    // ✅ TRIGGER FUNCTION AGAIN (VERY IMPORTANT)
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneTrigger",
      value: String(Date.now()),
    });

    console.log("🧹 Voucher removed & discount reset");

    setConfig(null);
  } catch (err) {
    console.error('[Paystone] handleRemove error:', err);
  } finally {
    setLoading(false);
  }
}

  return (
    <s-banner heading="Paystone Gift Voucher">
      <s-stack gap="base">
        <s-text-field
          label="Voucher Code"
          value={voucher}
          disabled={loading}
          onChange={(v) => {
            setError('');
            setVoucher(extractValue(v));
          }}
        />
      {shouldShowPin && (
        <s-text-field
          label="Enter PIN"
          value={pin}
          disabled={loading}
          onChange={(v) => {
            setPin(extractValue(v));
          }}
        />
      )}
        {error && <s-text tone="critical">{error}</s-text>}

        <s-stack direction="inline" gap="base">
          <s-button
            onClick={handleApply}
            disabled={loading || !voucher || !config}
          >
            Apply Voucher
          </s-button>
          <s-button onClick={handleRemove} tone="critical" disabled={loading}>
            Remove
          </s-button>
        </s-stack>
      </s-stack>
    </s-banner>
  );
}
