import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Loader fetches data using Prisma (server-side) 
export async function loader({ request }) {
const { session } = await authenticate.admin(request); 
// Get numeric shopId from DB 
const shop = await prisma.shop.findUnique({ 
  where: { shopDomain: session.shop }, });
  if (!shop) throw new Error("Shop not found");
  const paystone = await prisma.paystoneConfig.findUnique({ 
  where: { shopId: shop.id }, 
  }); 
  return paystone
  ? {
      ...paystone,
      shopId: paystone.shopId.toString(),
      skipPinVerification: Boolean(paystone.skipPinVerification),
    }
  : null;
}

export default function PaystoneSettings() {
const loaderData = useLoaderData();
const fetcher = useFetcher();
const [showToast, setShowToast] = useState(false);

const [formData, setFormData] = useState({
merchantUniqueId: loaderData?.merchantUniqueId || "",
merchantPassword: loaderData?.merchantPassword || "",
clientAccessKey: loaderData?.clientAccessKey || "",
gatewayUrl: loaderData?.gatewayUrl || "",
apiVersion: loaderData?.apiVersion || "",
preAuthTimeoutMinutes: loaderData?.preAuthTimeoutMinutes || 5,
skipPinVerification: loaderData?.skipPinVerification ?? false,

});

const handleChange = (e) => {
const { name, value, type, checked } = e.target;
setFormData((prev) => ({
...prev,
[name]: type === "checkbox" ? checked : value,
}));
};

const handleSubmit = (e) => {
e.preventDefault();
fetcher.submit(formData, { method: "post", action: "/paystoneapi" });
};

useEffect(() => {
  if (fetcher.state === "idle" && fetcher.data?.success) {
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  }
}, [fetcher.state, fetcher.data]);
return (
<div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
<h1 style={{ textAlign: "center", marginBottom: "24px" }}>Paystone Gateway Settings</h1>
<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: 500 }}>Merchant Unique ID (MID):</label>
      <input
        type="text"
        name="merchantUniqueId"
        value={formData.merchantUniqueId}
        onChange={handleChange}
        style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
        placeholder="Enter Merchant ID"
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: 500 }}>Merchant Password (MPW):</label>
      <input
        type="password"
        name="merchantPassword"
        value={formData.merchantPassword}
        onChange={handleChange}
        style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
        placeholder="Enter Merchant Password"
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: 500 }}>Client Access Key:</label>
      <input
        type="text"
        name="clientAccessKey"
        value={formData.clientAccessKey}
        onChange={handleChange}
        style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
        placeholder="Enter Client Access Key"
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: 500 }}>Gateway URL:</label>
      <input
        type="text"
        name="gatewayUrl"
        value={formData.gatewayUrl}
        onChange={handleChange}
        style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
        placeholder="Enter Gateway URL"
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: 500 }}>API Version:</label>
      <input
        type="text"
        name="apiVersion"
        value={formData.apiVersion}
        onChange={handleChange}
        style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
        placeholder="Enter API Version"
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: 500 }}>Pre-Authorization Timeout (Minutes):</label>
      <input
        type="number"
        name="preAuthTimeoutMinutes"
        value={formData.preAuthTimeoutMinutes}
        onChange={handleChange}
        style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
        placeholder="Enter Timeout in Minutes"
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
    <label htmlFor="skipPinVerification" style={{ marginBottom: "6px", fontWeight: 500 }}>
        Skip PIN Verification:
    </label>
    <select
        name="skipPinVerification"
        id="skipPinVerification"
        value={formData.skipPinVerification ? "true" : "false"} // ✔️ Changed yes/no → true/false
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            skipPinVerification: e.target.value === "true", // ✔️ Updated
          }))
        }
        style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", }}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>


    <button
      type="submit"
      style={{ padding: "10px 16px", backgroundColor: "#356c74", color: "#fff", fontWeight: 500, borderRadius: "6px", border: "none",cursor: "pointer",
        transition: "background-color 0.2s"
      }}
      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2c4346")}
      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#356c74")}
    >
      Save Settings
    </button>

  </form>
  {showToast && (
  <div
    style={{
      position: "center",
      marginTop:"20px",
      backgroundColor: "#2e7d32",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "6px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      zIndex: 1000,
    }}
  >
    Settings saved successfully
  </div>
)}
</div>
)
}
