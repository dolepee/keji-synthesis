import "dotenv/config";

import { z } from "zod";

const configSchema = z.object({
  KEJI_OPERATOR_NAME: z.string().default("Operator"),
  KEJI_OPERATOR_EMAIL: z.string().email().default("operator@example.com"),
  KEJI_MAX_AUTONOMOUS_SPEND_USD: z.coerce.number().positive().default(25),
  KEJI_COMPUTE_BUDGET_USD: z.coerce.number().positive().default(10),
  KEJI_DEFAULT_X402_PRICE_USD: z.coerce.number().positive().default(2.5),
  KEJI_DEFAULT_MODEL: z.string().default("bankr-gateway"),
  KEJI_LOG_LEVEL: z.enum(["info", "warn", "error"]).default("info"),
  KEJI_HUMAN_FULL_NAME: z.string().optional(),
  KEJI_HUMAN_SOCIAL_HANDLE: z.string().optional(),
  KEJI_REGISTRATION_IMAGE_URL: z.string().url().optional().or(z.literal("")),
  BANKR_LLM_KEY: z.string().optional(),
  KEJI_BANKR_MODEL_ID: z.string().default("claude-sonnet-4.6"),
  KEJI_X402_ENDPOINT_URL: z.string().url().optional().or(z.literal("")),
  KEJI_AGENTCASH_REMOTE_HOST: z.string().optional(),
  KEJI_AGENTCASH_REMOTE_KEY_PATH: z.string().optional(),
  KEJI_X402_MAX_AMOUNT_USD: z.coerce.number().positive().default(0.05),
  STATUS_RPC_URL: z.string().url().default("https://public.sepolia.rpc.status.network"),
  STATUS_CHAIN_ID: z.coerce.number().int().positive().default(1660990954),
  STATUS_NETWORK_NAME: z.string().default("Status Network Sepolia"),
  STATUS_EXPLORER_BASE_URL: z.string().url().default("https://sepoliascan.status.network"),
  STATUS_PRIVATE_KEY: z.string().optional(),
  STATUS_RECEIPT_REGISTRY_ADDRESS: z.string().optional(),
  KEJI_X402_SERVER_PORT: z.coerce.number().int().positive().default(3402),
  KEJI_X402_REPORT_PRICE_USD: z.coerce.number().positive().default(0.01),
  KEJI_X402_PAY_TO: z.string().default("0x8942F989343e4Ce8e4c8c0D7C648a6953ff3A5A2")
});

const parsed = configSchema.parse(process.env);

export const config = {
  operatorName: parsed.KEJI_OPERATOR_NAME,
  operatorEmail: parsed.KEJI_OPERATOR_EMAIL,
  policy: {
    maxAutonomousSpendUsd: parsed.KEJI_MAX_AUTONOMOUS_SPEND_USD,
    computeBudgetUsd: parsed.KEJI_COMPUTE_BUDGET_USD,
    requiresVerificationBeforeSubmit: true
  },
  defaultX402PriceUsd: parsed.KEJI_DEFAULT_X402_PRICE_USD,
  defaultModel: parsed.KEJI_DEFAULT_MODEL,
  logLevel: parsed.KEJI_LOG_LEVEL,
  humanFullName: parsed.KEJI_HUMAN_FULL_NAME?.trim() || "",
  humanSocialHandle: parsed.KEJI_HUMAN_SOCIAL_HANDLE?.trim() || "",
  registrationImageUrl: parsed.KEJI_REGISTRATION_IMAGE_URL?.trim() || "",
  bankr: {
    apiKey: parsed.BANKR_LLM_KEY?.trim() || "",
    modelId: parsed.KEJI_BANKR_MODEL_ID
  },
  agentcash: {
    endpointUrl: parsed.KEJI_X402_ENDPOINT_URL?.trim() || "",
    remoteHost: parsed.KEJI_AGENTCASH_REMOTE_HOST?.trim() || "",
    remoteKeyPath: parsed.KEJI_AGENTCASH_REMOTE_KEY_PATH?.trim() || "",
    maxAmountUsd: parsed.KEJI_X402_MAX_AMOUNT_USD
  },
  status: {
    rpcUrl: parsed.STATUS_RPC_URL.trim(),
    chainId: parsed.STATUS_CHAIN_ID,
    networkName: parsed.STATUS_NETWORK_NAME.trim(),
    explorerBaseUrl: parsed.STATUS_EXPLORER_BASE_URL.trim().replace(/\/$/, ""),
    privateKey: parsed.STATUS_PRIVATE_KEY?.trim() || "",
    receiptRegistryAddress: parsed.STATUS_RECEIPT_REGISTRY_ADDRESS?.trim() || ""
  },
  x402Server: {
    port: parsed.KEJI_X402_SERVER_PORT,
    reportPriceUsd: parsed.KEJI_X402_REPORT_PRICE_USD,
    payTo: parsed.KEJI_X402_PAY_TO
  }
};
