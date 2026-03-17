/**
 * Direct token deployment via Clanker v4 SDK on Base.
 * Fallback when Bankr Agent API doesn't have deploy capability.
 * Creates Uniswap V4 pool with fee revenue flowing to creator.
 */
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { readJsonFileOrDefault, writeJsonFile } from "../lib/fs-store.js";
import { paths } from "../lib/paths.js";
import { recordRevenue } from "../lib/treasury.js";

export interface TokenState {
  launched: boolean;
  tokenName: string;
  tokenSymbol: string;
  contractAddress: string;
  poolAddress: string;
  chain: string;
  launchedAt: string;
  deployTxHash: string;
  totalFeesClaimedUsd: number;
  feeClaims: Array<{
    amountRaw: string;
    estimatedUsd: number;
    claimedAt: string;
  }>;
}

export async function loadTokenState(): Promise<TokenState | null> {
  return readJsonFileOrDefault<TokenState | null>(paths.tokenState, null);
}

async function saveTokenState(state: TokenState): Promise<void> {
  await writeJsonFile(paths.tokenState, state);
}

function getBasePrivateKey(): `0x${string}` {
  const key = process.env.BASE_PRIVATE_KEY?.trim();
  if (!key) throw new Error("BASE_PRIVATE_KEY not set. Need a funded wallet on Base for token deployment.");
  return key as `0x${string}`;
}

export function isClankerConfigured(): boolean {
  return Boolean(process.env.BASE_PRIVATE_KEY?.trim());
}

/**
 * Deploy $KEJI token via Clanker v4 on Base mainnet.
 */
export async function deployToken(opts: {
  name: string;
  symbol: string;
  imageUrl?: string;
}): Promise<TokenState> {
  const privateKey = getBasePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http()
  });

  console.log(`\n=== Deploying $${opts.symbol} via Clanker v4 on Base ===`);
  console.log(`  Deployer: ${account.address}`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`  Balance: ${formatEther(balance)} ETH`);
  if (balance < 1_000_000_000_000_000n) { // < 0.001 ETH
    throw new Error(`Insufficient ETH for deployment. Have ${formatEther(balance)} ETH, need ~0.01 ETH.`);
  }

  // Dynamic import of clanker-sdk (ESM)
  const { Clanker } = await import("clanker-sdk/v4");

  const clanker = new Clanker({
    publicClient: publicClient as any,
    wallet: walletClient as any
  });

  console.log(`  Deploying token...`);
  const { txHash, waitForTransaction, error } = await clanker.deploy({
    name: opts.name,
    symbol: opts.symbol,
    image: opts.imageUrl,
    tokenAdmin: account.address
  });

  if (error) {
    throw new Error(`Clanker deploy failed: ${error}`);
  }

  console.log(`  TX Hash: ${txHash}`);
  console.log(`  Waiting for confirmation...`);

  const txResult = await waitForTransaction();
  if (txResult.error) {
    throw new Error(`Transaction failed: ${txResult.error}`);
  }
  const tokenAddress = txResult.address ?? "";
  console.log(`  Token deployed at: ${tokenAddress}`);

  const state: TokenState = {
    launched: true,
    tokenName: opts.name,
    tokenSymbol: opts.symbol,
    contractAddress: tokenAddress,
    poolAddress: "",
    chain: "base",
    launchedAt: new Date().toISOString(),
    deployTxHash: txHash,
    totalFeesClaimedUsd: 0,
    feeClaims: []
  };

  await saveTokenState(state);

  console.log(`\n  ✓ $${opts.symbol} deployed!`);
  console.log(`  Token: ${tokenAddress}`);
  console.log(`  TX: https://basescan.org/tx/${txHash}`);

  return state;
}

