import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function safeJson(data) {
  return JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

function getGatewayBaseUrl(config) {
  const rawGatewayUrl = (config.gatewayUrl || "").trim();

  if (!rawGatewayUrl) {
    return `https://rootways.dcuat.com/ms2v2/trx/${config.clientAccessKey}/fit/`;
  }

  const normalizedGatewayUrl = /^https?:\/\//i.test(rawGatewayUrl)
    ? rawGatewayUrl
    : `https://${rawGatewayUrl}`;

  const configuredBase = normalizedGatewayUrl.replace(/\/$/, "");

  if (configuredBase) {
    if (/\/fit$/i.test(configuredBase) || /\/fit\/$/i.test(normalizedGatewayUrl)) {
      return `${configuredBase.replace(/\/$/, "")}/`;
    }

    if (/\/trx$/i.test(configuredBase) || /\/trx\/$/i.test(normalizedGatewayUrl)) {
      return `${configuredBase}/${config.clientAccessKey}/fit/`;
    }

    return `${configuredBase}/ms2v2/trx/${config.clientAccessKey}/fit/`;
  }
}

function buildPaystoneUrl({ config, trx, pin, cid, amount, tcr, inv }) {
  const params = new URLSearchParams({
    MID: config.merchantUniqueId,
    MPW: config.merchantPassword,
    PRG: "ppd",
    TRX: trx,
    VER: config.apiVersion || "2010-01-06",
    LNG: "en",
    WAN: "1",
    WSN: "1",
  });

  if (pin && pin.trim()) {
    params.set("VDP", "TRUE");
    params.set("PIN", pin.trim());
  }

  if (cid) {
    params.set("CID", cid);
  }

  if (amount !== undefined && amount !== null && amount !== "") {
    params.set("AMT", String(amount));
  }

  if (tcr) {
    params.set("TCR", tcr);
  }

  if (inv) {
    params.set("INV", String(inv));
  }

  if (trx === "bal") {
    params.set("DAT", "");
  }

  if (trx === "loc" || trx === "rul" || trx === "ccl") {
    params.set("ACT", "0");
  }

  return `${getGatewayBaseUrl(config)}?${params.toString()}`;
}

function parsePaystoneResponse(raw) {
  const response = {};

  for (const part of String(raw || "").split("&")) {
    const [key, ...rest] = part.split("=");
    if (!key) {
      continue;
    }

    const value = rest.join("=");
    if (value !== undefined && value !== "") {
      response[key] = decodeURIComponent(value);
    }
  }

  return response;
}

function generateInvoice() {
  return Math.floor(Math.random() * 900) + 100;
}

async function callPaystone(url, label) {
  console.log(`[Paystone] ${label} URL:`, url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/xml",
    },
  });

  const raw = await response.text();
  const parsed = parsePaystoneResponse(raw);

  console.log(`[Paystone] ${label} raw response:`, raw);
  console.log(`[Paystone] ${label} parsed response:`, parsed);

  return {
    ok: response.ok,
    status: response.status,
    raw,
    parsed,
  };
}

function jsonResponse(data, status = 200) {
  return new Response(safeJson(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function getShopConfig(shop) {
  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    return {
      error: jsonResponse(
        {
          success: false,
          error: "Shop not found",
        },
        404
      ),
    };
  }

  const config = await prisma.paystoneConfig.findUnique({
    where: { shopId: shopRecord.id },
  });

  if (!config) {
    return {
      error: jsonResponse(
        {
          success: false,
          error: "Paystone config not found",
        },
        404
      ),
    };
  }

  return {config};
}

async function lockAndCommit({ config, voucher, pin, requestedAmount }) {
  const inv = generateInvoice();

  console.log("[Paystone] Starting LOC transaction", {
    voucher,
    pinPresent: Boolean(pin),
    requestedAmount,
    inv,
  });

  const lockUrl = buildPaystoneUrl({
    config,
    trx: "loc",
    pin,
    cid: voucher,
    amount: requestedAmount.toFixed(2),
    inv,
  });

  const lockResponse = await callPaystone(lockUrl, "LOC");

  if (!lockResponse.parsed.TCN) {
    console.log("[Paystone] LOC failed before commit");
    return jsonResponse({
      success: false,
      step: "loc",
      error: lockResponse.parsed.MSG || "Failed to lock voucher amount",
      lockResponse,
    });
  }

  const commitUrl = buildPaystoneUrl({
    config,
    trx: "cmt",
    pin,
    cid: voucher,
    tcr: lockResponse.parsed.TCN,
  });

  const commitResponse = await callPaystone(commitUrl, "CMT");

  if (!commitResponse.parsed.TCR) {
    console.log("[Paystone] Commit failed after lock");
    return jsonResponse({
      success: false,
      step: "cmt",
      error: commitResponse.parsed.MSG || "Failed to commit locked voucher amount",
      lockResponse,
      commitResponse,
    });
  }

  const lockData = {
    status: 1,
    msg: "",
    updated_at: new Date().toISOString(),
    amt: requestedAmount.toFixed(2),
    cid: voucher,
    pin,
    tcr: commitResponse.parsed.TCR,
    inv,
    tcn: lockResponse.parsed.TCN,
    voucherCode: voucher,
  };

  console.log("[Paystone] Transaction complete", lockData);

  return jsonResponse({
    success: true,
    step: "done",
    action: "lock",
    lockData,
    lockResponse,
    commitResponse,
  });
}

async function unlockAndCommit({ config, voucher, pin, amount, tcr, inv }) {
  console.log("[Paystone] Starting RUL transaction", {
    voucher,
    pinPresent: Boolean(pin),
    amount,
    tcr,
    inv,
  });

  const unlockUrl = buildPaystoneUrl({
    config,
    trx: "rul",
    pin,
    cid: voucher,
    amount,
    tcr,
    inv,
  });

  const unlockResponse = await callPaystone(unlockUrl, "RUL");

  if (!unlockResponse.parsed.TCN) {
    console.log("[Paystone] RUL failed before commit");
    return jsonResponse({
      success: false,
      step: "rul",
      error: unlockResponse.parsed.MSG || "Failed to unlock voucher amount",
      unlockResponse,
    });
  }

  const commitUrl = buildPaystoneUrl({
    config,
    trx: "cmt",
    pin,
    cid: voucher,
    tcr: unlockResponse.parsed.TCN,
  });

  const commitResponse = await callPaystone(commitUrl, "CMT_UNLOCK");

  if (!commitResponse.parsed.TCR) {
    console.log("[Paystone] Commit failed after unlock");
    return jsonResponse({
      success: false,
      step: "cmt_unlock",
      error: commitResponse.parsed.MSG || "Failed to commit unlocked voucher amount",
      unlockResponse,
      commitResponse,
    });
  }

  console.log("[Paystone] Unlock complete", {
    voucher,
    amount,
    tcr: commitResponse.parsed.TCR,
    inv,
  });

  return jsonResponse({
    success: true,
    step: "done",
    action: "unlock",
    unlockData: {
      status: 1,
      msg: "",
      updated_at: new Date().toISOString(),
      amt: String(amount),
      cid: voucher,
      pin,
      tcr: commitResponse.parsed.TCR,
      inv,
      voucherCode: voucher,
    },
    unlockResponse,
    commitResponse,
  });
}

async function cancelAndCommit({ config, voucher, pin, amount, tcr, inv }) {
  console.log("[Paystone] Starting CCL transaction", {
    voucher,
    pinPresent: Boolean(pin),
    amount,
    tcr,
    inv,
  });

  const cancelUrl = buildPaystoneUrl({
    config,
    trx: "ccl",
    pin,
    cid: voucher,
    amount,
    tcr,
    inv,
  });

  const cancelResponse = await callPaystone(cancelUrl, "CCL");

  if (!cancelResponse.parsed.TCN) {
    console.log("[Paystone] CCL failed before commit");
    return jsonResponse({
      success: false,
      step: "ccl",
      error: cancelResponse.parsed.MSG || "Failed to cancel voucher transaction",
      cancelResponse,
    });
  }

  const commitUrl = buildPaystoneUrl({
    config,
    trx: "cmt",
    pin,
    cid: voucher,
    tcr: cancelResponse.parsed.TCN,
  });

  const commitResponse = await callPaystone(commitUrl, "CMT_CANCEL");

  if (!commitResponse.parsed.TCR) {
    console.log("[Paystone] Commit failed after cancel");
    return jsonResponse({
      success: false,
      step: "cmt_cancel",
      error: commitResponse.parsed.MSG || "Failed to commit voucher cancel",
      cancelResponse,
      commitResponse,
    });
  }

  console.log("[Paystone] Cancel complete", {
    voucher,
    amount,
    tcr: commitResponse.parsed.TCR,
    inv,
  });

  return jsonResponse({
    success: true,
    step: "done",
    action: "cancel",
    cancelData: {
      status: 1,
      msg: "",
      updated_at: new Date().toISOString(),
      amt: String(amount),
      cid: voucher,
      pin,
      tcr: commitResponse.parsed.TCR,
      inv,
      voucherCode: voucher,
    },
    cancelResponse,
    commitResponse,
  });
}

export function options() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    console.log("[Paystone] OPTIONS preflight received");
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return new Response(
    safeJson({
      success: false,
      error: "Method not allowed",
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    }
  );
}

export async function action({ request }) {
  try {
    const body = await request.json();
    const {
      action: transactionAction = "lock",
      shop,
      voucher,
      pin = "",
      amount,
      tcr,
      inv,
    } = body || {};

    console.log("[Paystone] Transaction request body:", body);

    if (!shop || !voucher) {
      return jsonResponse({
          success: false,
          error: "Missing shop or voucher",
        }, 400);
    }
    const configResult = await getShopConfig(shop);
    if (configResult.error) {
      return configResult.error;
    }

    const {config} = configResult;

    if (transactionAction === "unlock") {
      const unlockAmount = Number.parseFloat(amount || "0");

      if (!Number.isFinite(unlockAmount) || unlockAmount <= 0 || !tcr || !inv) {
        return jsonResponse({
          success: false,
          error: "Invalid unlock payload. Amount, TCR and INV are required.",
        }, 400);
      }

      return unlockAndCommit({
        config,
        voucher,
        pin,
        amount: unlockAmount.toFixed(2),
        tcr,
        inv,
      });
    }

    if (transactionAction === "cancel") {
      const cancelAmount = Number.parseFloat(amount || "0");

      if (!Number.isFinite(cancelAmount) || cancelAmount <= 0 || !tcr || !inv) {
        return jsonResponse({
          success: false,
          error: "Invalid cancel payload. Amount, TCR and INV are required.",
        }, 400);
      }

      return cancelAndCommit({
        config,
        voucher,
        pin,
        amount: cancelAmount.toFixed(2),
        tcr,
        inv,
      });
    }

    const requestedAmount = Number.parseFloat(amount || "0");
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return jsonResponse({
        success: false,
        error: "Invalid amount requested for lock",
      }, 400);
    }

    return lockAndCommit({
      config,
      voucher,
      pin,
      requestedAmount,
    });
  } catch (error) {
    console.error("[Paystone] Transaction error:", error);

    return jsonResponse({
        success: false,
        error: error.message || "Internal Server Error",
      }, 500);
  }
}
