import { paths } from "./paths.js";
import { readJsonFileOrDefault, writeJsonFile } from "./fs-store.js";
import type { AgentRunReceipt, AgentTreasury } from "../types.js";

const BANKR_COST_PER_CALL_USD = 0.003;

function emptyTreasury(): AgentTreasury {
  return {
    totalSpentUsd: 0,
    totalInferenceCostUsd: 0,
    totalX402SpendUsd: 0,
    totalReceiptsAnchored: 0,
    totalTasksCompleted: 0,
    revenueEarnedUsd: 0,
    revenueSourceBreakdown: [],
    netPositionUsd: 0,
    selfSustainabilityRatio: 0,
    updatedAt: new Date().toISOString()
  };
}

export async function loadTreasury(): Promise<AgentTreasury> {
  return readJsonFileOrDefault<AgentTreasury>(paths.treasury, emptyTreasury());
}

export async function saveTreasury(treasury: AgentTreasury): Promise<void> {
  treasury.netPositionUsd =
    Math.round((treasury.revenueEarnedUsd - treasury.totalSpentUsd) * 1000) / 1000;
  treasury.selfSustainabilityRatio =
    treasury.totalSpentUsd > 0
      ? Math.round((treasury.revenueEarnedUsd / treasury.totalSpentUsd) * 100) / 100
      : 0;
  treasury.updatedAt = new Date().toISOString();
  await writeJsonFile(paths.treasury, treasury);
}

export async function recordTaskCosts(receipt: AgentRunReceipt): Promise<AgentTreasury> {
  const treasury = await loadTreasury();

  const usedBankr = receipt.result.provider === "bankr";
  const usedAgentCash = receipt.result.paidInputProvider === "agentcash";
  const inferenceCost = usedBankr ? BANKR_COST_PER_CALL_USD : 0;
  const x402Cost = usedAgentCash ? receipt.result.totalEstimatedCostUsd : 0;

  treasury.totalInferenceCostUsd =
    Math.round((treasury.totalInferenceCostUsd + inferenceCost) * 1000) / 1000;
  treasury.totalX402SpendUsd =
    Math.round((treasury.totalX402SpendUsd + x402Cost) * 1000) / 1000;
  treasury.totalSpentUsd =
    Math.round((treasury.totalSpentUsd + inferenceCost + x402Cost) * 1000) / 1000;
  treasury.totalTasksCompleted += 1;

  if (receipt.proof) {
    treasury.totalReceiptsAnchored += 1;
  }

  await saveTreasury(treasury);
  return treasury;
}

export async function recordRevenue(
  source: string,
  amountUsd: number
): Promise<AgentTreasury> {
  const treasury = await loadTreasury();

  treasury.revenueEarnedUsd =
    Math.round((treasury.revenueEarnedUsd + amountUsd) * 1000) / 1000;
  treasury.revenueSourceBreakdown.push({
    source,
    amountUsd,
    timestamp: new Date().toISOString()
  });

  await saveTreasury(treasury);
  return treasury;
}
