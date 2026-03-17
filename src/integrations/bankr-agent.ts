import { config } from "../config.js";
import { readJsonFileOrDefault, writeJsonFile } from "../lib/fs-store.js";
import { paths } from "../lib/paths.js";
import { recordRevenue } from "../lib/treasury.js";

const AGENT_API_BASE = "https://api.bankr.bot/agent";
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 120; // 6 minutes max

export interface BankrAgentJob {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  response?: string;
}

export interface TokenLaunchResult {
  success: boolean;
  tokenName: string;
  tokenSymbol: string;
  contractAddress?: string;
  poolAddress?: string;
  chain: string;
  launchedAt: string;
  bankrJobId: string;
  rawResponse: string;
}

export interface FeeClaimResult {
  success: boolean;
  tokenName: string;
  amountClaimed?: string;
  currency?: string;
  claimedAt: string;
  bankrJobId: string;
  rawResponse: string;
}

export interface TokenState {
  launched: boolean;
  tokenName: string;
  tokenSymbol: string;
  contractAddress: string;
  poolAddress: string;
  chain: string;
  launchedAt: string;
  totalFeesClaimedUsd: number;
  feeClaims: Array<{
    amountRaw: string;
    estimatedUsd: number;
    claimedAt: string;
  }>;
}

function getApiKey(): string {
  // Use BANKR_AGENT_API_KEY if set, otherwise fall back to LLM key
  const agentKey = process.env.BANKR_AGENT_API_KEY?.trim();
  if (agentKey) return agentKey;
  return config.bankr.apiKey;
}

export function isBankrAgentConfigured(): boolean {
  return Boolean(getApiKey());
}

async function submitPrompt(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Bankr Agent API key not configured");

  const res = await fetch(`${AGENT_API_BASE}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(30_000)
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bankr Agent API submit failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { jobId?: string };
  if (!data.jobId) throw new Error("Bankr Agent API did not return a jobId");
  return data.jobId;
}

async function pollJob(jobId: string): Promise<BankrAgentJob> {
  const apiKey = getApiKey();

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(`${AGENT_API_BASE}/job/${jobId}`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(15_000)
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bankr job poll failed (${res.status}): ${body}`);
    }

    const job = (await res.json()) as BankrAgentJob;
    job.jobId = jobId;

    if (job.status === "completed" || job.status === "failed") {
      return job;
    }

    console.log(`  [bankr] Job ${jobId} status: ${job.status} (attempt ${attempt + 1})`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Bankr job ${jobId} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

export async function loadTokenState(): Promise<TokenState | null> {
  return readJsonFileOrDefault<TokenState | null>(paths.tokenState, null);
}

async function saveTokenState(state: TokenState): Promise<void> {
  await writeJsonFile(paths.tokenState, state);
}

/**
 * Launch the $KEJI token via Bankr Agent API.
 * Uses Clanker under the hood for Uniswap V4 pool creation on Base.
 */
export async function launchToken(opts: {
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
}): Promise<TokenLaunchResult> {
  console.log(`\n=== Launching $${opts.symbol} via Bankr Agent API ===`);
  console.log(`  Name: ${opts.name}`);
  console.log(`  Symbol: ${opts.symbol}`);
  console.log(`  Description: ${opts.description}`);

  const prompt = opts.imageUrl
    ? `Launch a token called "${opts.name}" with symbol "${opts.symbol}" on Base. Description: "${opts.description}". Image URL: ${opts.imageUrl}`
    : `Launch a token called "${opts.name}" with symbol "${opts.symbol}" on Base. Description: "${opts.description}"`;

  console.log(`  Submitting to Bankr Agent API...`);
  const jobId = await submitPrompt(prompt);
  console.log(`  Job ID: ${jobId}`);

  const job = await pollJob(jobId);
  const rawResponse = job.response ?? "";

  console.log(`  Job completed. Response:`);
  console.log(`  ${rawResponse.slice(0, 500)}`);

  // Parse contract address from response if present
  const addressMatch = rawResponse.match(/0x[a-fA-F0-9]{40}/g);
  const contractAddress = addressMatch?.[0] ?? "";
  const poolAddress = addressMatch?.[1] ?? "";

  const result: TokenLaunchResult = {
    success: job.status === "completed",
    tokenName: opts.name,
    tokenSymbol: opts.symbol,
    contractAddress,
    poolAddress,
    chain: "base",
    launchedAt: new Date().toISOString(),
    bankrJobId: jobId,
    rawResponse
  };

  if (result.success) {
    const state: TokenState = {
      launched: true,
      tokenName: opts.name,
      tokenSymbol: opts.symbol,
      contractAddress,
      poolAddress,
      chain: "base",
      launchedAt: result.launchedAt,
      totalFeesClaimedUsd: 0,
      feeClaims: []
    };
    await saveTokenState(state);
    console.log(`\n  $${opts.symbol} launched successfully!`);
    if (contractAddress) console.log(`  Contract: ${contractAddress}`);
    if (poolAddress) console.log(`  Pool: ${poolAddress}`);
  }

  return result;
}

/**
 * Claim accumulated trading fees from the $KEJI token.
 * Fees are paid in ETH/WETH — creator gets 60% of swap fees.
 */
export async function claimTokenFees(tokenName?: string): Promise<FeeClaimResult> {
  const state = await loadTokenState();
  const name = tokenName ?? state?.tokenName ?? "KEJI";

  console.log(`\n=== Claiming fees for $${name} ===`);

  const prompt = `Claim my fees for ${name}`;
  const jobId = await submitPrompt(prompt);
  console.log(`  Job ID: ${jobId}`);

  const job = await pollJob(jobId);
  const rawResponse = job.response ?? "";

  console.log(`  Claim response: ${rawResponse.slice(0, 500)}`);

  // Try to parse amount from response
  const amountMatch = rawResponse.match(/([\d.]+)\s*(ETH|WETH|USD)/i);
  const amountClaimed = amountMatch?.[1] ?? "0";
  const currency = amountMatch?.[2] ?? "ETH";

  const result: FeeClaimResult = {
    success: job.status === "completed",
    tokenName: name,
    amountClaimed,
    currency,
    claimedAt: new Date().toISOString(),
    bankrJobId: jobId,
    rawResponse
  };

  // Record as revenue if we got a positive amount
  const usdEstimate = estimateUsd(amountClaimed, currency);
  if (usdEstimate > 0 && state) {
    state.totalFeesClaimedUsd += usdEstimate;
    state.feeClaims.push({
      amountRaw: `${amountClaimed} ${currency}`,
      estimatedUsd: usdEstimate,
      claimedAt: result.claimedAt
    });
    await saveTokenState(state);
    await recordRevenue(`token-fees:${name}`, usdEstimate);
    console.log(`  Recorded $${usdEstimate} revenue from token fees`);
  }

  return result;
}

/**
 * Check token balance/status via Bankr Agent API.
 */
export async function checkTokenStatus(tokenName?: string): Promise<string> {
  const state = await loadTokenState();
  const name = tokenName ?? state?.tokenName ?? "KEJI";

  const prompt = `What is the current status and trading volume of ${name} token?`;
  const jobId = await submitPrompt(prompt);
  const job = await pollJob(jobId);
  return job.response ?? "No response";
}

/**
 * Buy KEJI's own token to seed initial liquidity/volume.
 */
export async function seedBuy(tokenAddress: string, amountEth: string = "0.001"): Promise<string> {
  console.log(`\n=== Seed buy: ${amountEth} ETH of ${tokenAddress} ===`);
  const prompt = `Buy ${amountEth} ETH worth of token at ${tokenAddress} on Base`;
  const jobId = await submitPrompt(prompt);
  const job = await pollJob(jobId);
  console.log(`  Response: ${job.response?.slice(0, 300)}`);
  return job.response ?? "No response";
}

function estimateUsd(amount: string, currency: string): number {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return 0;
  // Rough ETH→USD conversion for fee tracking
  if (currency.toUpperCase() === "ETH" || currency.toUpperCase() === "WETH") {
    return Math.round(num * 2500 * 100) / 100; // ~$2500/ETH estimate
  }
  if (currency.toUpperCase() === "USD" || currency.toUpperCase() === "USDC") {
    return Math.round(num * 100) / 100;
  }
  return 0;
}
