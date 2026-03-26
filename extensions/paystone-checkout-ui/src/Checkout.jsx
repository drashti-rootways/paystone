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
  const shouldShowPin = config?.skipPinVerification === true;

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

  /**
   * 🔹 FETCH DATABASE CONFIG FROM app.paystoneapi-config
   */
async function fetchPaystoneConfigFromDB(voucherCode, pinValue = "") {
  try {
    const shopDomain = "rootways-plus-demo.myshopify.com";
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

  if (config?.skipPinVerification && !pin.trim()) {
    setError("Please enter PIN.");
    return;
  }

  setError('');
  setLoading(true);

  try {
    // ✅ STEP 1: Get Paystone URL
    const data = await fetchPaystoneConfigFromDB(voucher, pin);

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
      setError("Invalid or empty voucher");
      setLoading(false);
      return;
    }

    // ✅ SAVE BALANCE (VERY IMPORTANT)
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneBalance",
      value: String(balance),
    });

    // (Optional) save voucher info
    await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "paystoneConfig",
      value: JSON.stringify({
        voucherCode: voucher,
        pin,
      }),
    });

    console.log("✅ Balance saved → Reloading checkout");

    // ✅ FORCE FUNCTION RE-RUN
    setTimeout(() => {
      window.location.reload();
    }, 500);

  } catch (err) {
    console.error(err);
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
      const result = await shopify.applyAttributeChange({
        key: 'paystoneConfig',
        type: 'updateAttribute',
        value: '',
      });

      console.log('[Paystone] Voucher removed from checkout attributes:', result);
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
