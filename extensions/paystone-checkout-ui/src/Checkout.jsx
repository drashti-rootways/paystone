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
import { useState } from 'preact/hooks';

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
  async function fetchPaystoneConfigFromDB(voucherCode) {
  try {
    const shopDomain = "rootways-plus-demo.myshopify.com";

    const API_BASE = "https://paystone.vercel.app";

    const url =
      `${API_BASE}/app/paystoneapi-config` +
      `?voucher=${encodeURIComponent(voucherCode)}` +
      `&shop=${encodeURIComponent(shopDomain)}`;

    console.log("[Paystone] Calling API:", url);

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`API failed with status ${res.status}`);
    }

    const data = await res.json();

    console.log("[Paystone] Full database config fetched:", data);

    setConfig(data.config);

    return data.config;
  } catch (err) {
    console.error("[Paystone] Error fetching config from DB:", err);
    setError("Failed to fetch voucher config from database.");
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

    setError('');
    setLoading(true);

    try {
      // ✅ Fetch full PaystoneConfig from database via backend
      const dbConfig = await fetchPaystoneConfigFromDB(voucher);

      if (!dbConfig) {
        setLoading(false);
        return;
      }
      
      // ✅ ADD THIS HERE
      if (dbConfig?.skipPinVerification && !pin.trim()) {
        setError("Please enter PIN.");
        setLoading(false);
        return;
      }
      // Save voucher and config as a string in checkout attributes
      const checkoutConfig = {
        voucherCode: voucher,
         pin,
        ...dbConfig
      };

      const result = await shopify.applyAttributeChange({
        key: 'paystoneConfig', // must be string
        type: 'updateAttribute',
        value: JSON.stringify(checkoutConfig),
      });

      console.log('[Paystone] Config saved to checkout attributes:', checkoutConfig);
      console.log('[Paystone] Voucher applied result:', result);
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
            console.log('[Paystone] TextField changed:', v);
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
          <s-button onClick={handleApply} disabled={loading}>
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
