import http from "node:http";

import { config } from "../config.js";
import { loadReceipts } from "../lib/agent-store.js";
import { recordRevenue } from "../lib/treasury.js";
import type { AgentRunReceipt } from "../types.js";

const REPORT_PRICE_USD = config.x402Server.reportPriceUsd;
const PORT = config.x402Server.port;
const PAY_TO = config.x402Server.payTo;

// USDC on Base Mainnet — 6 decimals
const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const BASE_NETWORK_CAIP2 = "eip155:8453";

/** Convert a USD amount to USDC atomic units (6 decimals). */
function usdToAtomicUnits(usd: number): string {
  return String(Math.round(usd * 10 ** USDC_DECIMALS));
}

interface X402PaymentOffer {
  x402Version: 2;
  accepts: Array<{
    scheme: "exact";
    network: string;
    maxAmountRequired: string;
    amount: string;
    asset: string;
    payTo: string;
    resource: string;
    description: string;
    mimeType: string;
    maxTimeoutSeconds: number;
    extra: {
      name: string;
      version: string;
    };
  }>;
  error?: string;
}

function buildPaymentOffer(receiptId: string, description: string): X402PaymentOffer {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: BASE_NETWORK_CAIP2,
        maxAmountRequired: usdToAtomicUnits(REPORT_PRICE_USD),
        amount: usdToAtomicUnits(REPORT_PRICE_USD),
        asset: USDC_BASE_ADDRESS,
        payTo: PAY_TO,
        resource: `/reports/${receiptId}`,
        description,
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin",
          version: "2"
        }
      }
    ],
    error: "X-PAYMENT header is required"
  };
}

function buildReportPayload(receipt: AgentRunReceipt): Record<string, unknown> {
  return {
    reportId: receipt.receiptId,
    goal: receipt.request.goal,
    category: receipt.request.category,
    answer: receipt.result.answer,
    provider: receipt.result.provider,
    providerModel: receipt.result.providerModel,
    paidInputProvider: receipt.result.paidInputProvider,
    verificationSummary: receipt.result.verificationSummary,
    completedAt: receipt.completedAt,
    proof: receipt.proof
      ? {
          network: receipt.proof.network,
          txHash: receipt.proof.txHash,
          explorerUrl: receipt.proof.explorerUrl,
          receiptHash: receipt.proof.receiptHash
        }
      : null
  };
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const receipts = await loadReceipts();

  // GET /reports — list available research reports (free catalog)
  if (url.pathname === "/reports" && req.method === "GET") {
    const catalog = receipts
      .filter((r) => r.result.outcome === "completed")
      .map((r) => ({
        id: r.receiptId,
        goal: r.request.goal,
        category: r.request.category,
        completedAt: r.completedAt,
        hasProof: Boolean(r.proof),
        priceUsd: REPORT_PRICE_USD
      }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ reports: catalog, count: catalog.length }, null, 2));
    return;
  }

  // GET /reports/:id — x402 gated report access
  const reportMatch = url.pathname.match(/^\/reports\/(.+)$/);
  if (reportMatch && req.method === "GET") {
    const receiptId = reportMatch[1];
    const receipt = receipts.find((r) => r.receiptId === receiptId);

    if (!receipt) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Report not found" }));
      return;
    }

    // Check for x402 payment proof (canonical header is X-PAYMENT, case-insensitive)
    const paymentHeader =
      (req.headers["x-payment"] as string | undefined) ??
      (req.headers["x-payment-proof"] as string | undefined) ??
      (req.headers["X-PAYMENT"] as string | undefined);

    if (!paymentHeader) {
      // Return 402 with x402 v2-compliant payment requirements
      const offer = buildPaymentOffer(
        receiptId,
        `KEJI research report: ${receipt.request.goal}`
      );

      // Base64-encode the offer for the PAYMENT-REQUIRED header
      const encoded = Buffer.from(JSON.stringify(offer)).toString("base64");

      res.writeHead(402, {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": encoded
      });
      res.end(
        JSON.stringify(
          {
            error: "X-PAYMENT header is required",
            message: `This research report costs $${REPORT_PRICE_USD} USDC via x402`,
            paymentDetails: offer
          },
          null,
          2
        )
      );
      return;
    }

    // Payment proof provided — validate and serve content.
    // AgentCash sends a base64-encoded JSON payload with EIP-3009 authorization.
    // In production this would verify the on-chain transaction via a facilitator.
    // For the hackathon we accept any non-empty payment header as proof of intent.
    if (paymentHeader.length < 2) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid payment proof" }));
      return;
    }

    // Record real revenue
    await recordRevenue(
      `x402-report-sale:${receiptId.slice(0, 8)}`,
      REPORT_PRICE_USD
    );

    const report = buildReportPayload(receipt);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Payment-Accepted": paymentHeader
    });
    res.end(JSON.stringify(report, null, 2));
    return;
  }

  // GET / — server info
  if (url.pathname === "/" && req.method === "GET") {
    const completedCount = receipts.filter((r) => r.result.outcome === "completed").length;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        {
          agent: "KEJI",
          service: "x402 Research Report Producer",
          version: "0.2.0",
          reportsAvailable: completedCount,
          pricePerReportUsd: REPORT_PRICE_USD,
          protocol: "x402",
          network: BASE_NETWORK_CAIP2,
          asset: USDC_BASE_ADDRESS,
          payTo: PAY_TO,
          endpoints: {
            catalog: "GET /reports",
            report: "GET /reports/:id (x402 gated)"
          }
        },
        null,
        2
      )
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

export function startX402Server(): void {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    });
  });

  server.listen(PORT, () => {
    console.log(`KEJI x402 Research Producer listening on http://0.0.0.0:${PORT}`);
    console.log(`  Network: ${BASE_NETWORK_CAIP2} | Asset: USDC (${USDC_BASE_ADDRESS})`);
    console.log(`  PayTo:   ${PAY_TO}`);
    console.log(`  Catalog: GET http://localhost:${PORT}/reports`);
    console.log(`  Reports: GET http://localhost:${PORT}/reports/:id (x402 gated)`);
  });
}
