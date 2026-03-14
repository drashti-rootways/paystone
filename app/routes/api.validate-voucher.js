export async function action({ request }) {
  try {
    const { voucher } = await request.json();

    // Example vouchers stored in DB or hardcoded
    const vouchers = {
      "PAY100": 100,
      "PAY50": 50,
      "DEMO10": 10,
    };

    if (!voucher || !vouchers[voucher]) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        amount: vouchers[voucher], // discount value
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error("Voucher validation error:", error);
    return new Response(JSON.stringify({ valid: false }), { status: 500 });
  }
}
