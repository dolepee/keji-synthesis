import crypto from "node:crypto";

import { privateKeyToAccount } from "viem/accounts";

import { config } from "../config.js";
import { loadStatusWallet } from "../integrations/status.js";
import type { AgentLogEntry, AgentLogFile, AgentManifest, AgentRunReceipt } from "../types.js";
import { paths } from "./paths.js";
import { readJsonFile, readJsonFileOrDefault, writeJsonFile } from "./fs-store.js";

export async function loadManifest(): Promise<AgentManifest> {
  return readJsonFile<AgentManifest>(paths.agentManifest);
}

export async function saveManifest(manifest: AgentManifest): Promise<void> {
  await writeJsonFile(paths.agentManifest, manifest);
}

export async function syncManifest(): Promise<AgentManifest> {
  const manifest = await loadManifest();
  manifest.model.primary = config.defaultModel;
  const statusWallet = config.status.privateKey
    ? {
        address: privateKeyToAccount(normalizePrivateKey(config.status.privateKey)).address
      }
    : await loadStatusWallet();

  if (statusWallet) {
    manifest.operatorWallet = {
      address: statusWallet.address,
      chain: config.status.networkName
    };
  }
  manifest.tools = manifest.tools.map((tool) => {
    if (tool.name === "bankr") {
      return { ...tool, configured: Boolean(config.bankr.apiKey) };
    }
    if (tool.name === "agentcash") {
      return { ...tool, configured: Boolean(config.agentcash.endpointUrl) };
    }
    if (tool.name === "status-proof") {
      return {
        ...tool,
        configured: Boolean(statusWallet && config.status.receiptRegistryAddress)
      };
    }
    return tool;
  });
  manifest.constraints.computeBudget = `${config.policy.computeBudgetUsd} USD`;
  manifest.constraints.maxAutonomousSpend = `${config.policy.maxAutonomousSpendUsd} USD`;
  manifest.constraints.requiresVerificationBeforeSubmit =
    config.policy.requiresVerificationBeforeSubmit;
  await saveManifest(manifest);
  return manifest;
}

export async function loadLogFile(): Promise<AgentLogFile> {
  return readJsonFile<AgentLogFile>(paths.agentLog);
}

export async function appendLogEntry(
  entry: Omit<AgentLogEntry, "id" | "timestamp">
): Promise<AgentLogEntry> {
  const logFile = await loadLogFile();
  const completeEntry: AgentLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
  logFile.entries.push(completeEntry);
  await writeJsonFile(paths.agentLog, logFile);
  return completeEntry;
}

export async function loadReceipts(): Promise<AgentRunReceipt[]> {
  return readJsonFileOrDefault<AgentRunReceipt[]>(paths.receipts, []);
}

export async function getLatestReceipt(): Promise<AgentRunReceipt | null> {
  const receipts = await loadReceipts();
  return receipts.at(-1) ?? null;
}

export async function appendReceipt(receipt: AgentRunReceipt): Promise<void> {
  const receipts = await loadReceipts();
  receipts.push(receipt);
  await writeJsonFile(paths.receipts, receipts);
  await appendLogEntry({
    level: "info",
    phase: "receipt_written",
    requestId: receipt.request.id,
    message: `Receipt ${receipt.receiptId} written for request ${receipt.request.id}`,
    data: {
      request: receipt.request,
      plan: receipt.plan,
      result: receipt.result,
      completedAt: receipt.completedAt
    }
  });
}

export async function replaceReceipt(receipt: AgentRunReceipt): Promise<void> {
  const receipts = await loadReceipts();
  const index = receipts.findIndex((candidate) => candidate.receiptId === receipt.receiptId);

  if (index === -1) {
    receipts.push(receipt);
  } else {
    receipts[index] = receipt;
  }

  await writeJsonFile(paths.receipts, receipts);
}

function normalizePrivateKey(value: string): `0x${string}` {
  return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
}
