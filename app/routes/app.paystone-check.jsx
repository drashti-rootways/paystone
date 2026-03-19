// app/routes/app.paystone-check.jsx

/* =========================
   CORS HEADERS
========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* =========================
   OPTIONS
========================= */
export function options() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/* =========================
   LOADER
========================= */
export async function loader({ request }) {
  try {
    const url = new URL(request.url);
    const paystoneUrl = url.searchParams.get("url");

    if (!paystoneUrl) {
      return new Response(
        JSON.stringify({ error: "Missing URL" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("🔹 Calling Paystone URL:", paystoneUrl);

    // ✅ CALL PAYSTONE API
    const response = await fetch(paystoneUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/xml",
      },
    });

    const text = await response.text();

    console.log("🔹 Paystone RAW Response:", text);

    return new Response(
      JSON.stringify({
        success: true,
        raw: text,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error("❌ Paystone Check Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal Server Error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}