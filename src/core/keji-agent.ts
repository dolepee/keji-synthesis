import crypto from "node:crypto";

import { config } from "../config.js";
import { appendLogEntry, appendReceipt, syncManifest } from "../lib/agent-store.js";
import { runAgentCashPurchase } from "../integrations/agentcash.js";
import { runBankrReasoning } from "../integrations/bankr.js";
import { anchorReceiptOnStatus, isStatusReadyForAnchoring } from "../integrations/status.js";
import { buildTaskPlan } from "./planner.js";
import { evaluateSpendPolicy } from "./policy.js";
import { executeTask } from "./executor.js";
import { recordTaskCosts } from "../lib/treasury.js";
import type { AgentRunReceipt, TaskRequest } from "../types.js";

export async function runKejiTask(goal: string): Promise<AgentRunReceipt> {
  await syncManifest();

  const request: TaskRequest = {
    id: crypto.randomUUID(),
    goal,
    requestedBy: config.operatorName,
    category: "paid-research",
    estimatedToolCostUsd: config.defaultX402PriceUsd,
    maxAcceptableSpendUsd: config.policy.maxAutonomousSpendUsd
  };

  await appendLogEntry({
    level: "info",
    phase: "received",
    requestId: request.id,
    message: `Received task request: ${goal}`,
    data: {
      requestedBy: request.requestedBy,
      category: request.category
    }
  });

  const plan = buildTaskPlan(request);
  await appendLogEntry({
    level: "info",
    phase: "planned",
    requestId: request.id,
    message: "Built task plan",
    data: {
      summary: plan.summary,
      chosenModel: plan.chosenModel,
      chosenTool: plan.chosenTool,
      executionSteps: plan.executionSteps
    }
  });

  const policyDecision = evaluateSpendPolicy(request, config.policy);
  await appendLogEntry({
    level: policyDecision.allowed ? "info" : "warn",
    phase: "budget_checked",
    requestId: request.id,
    message: policyDecision.reason,
    data: {
      estimatedToolCostUsd: request.estimatedToolCostUsd,
      maxAutonomousSpendUsd: config.policy.maxAutonomousSpendUsd,
      computeBudgetUsd: config.policy.computeBudgetUsd
    }
  });

  if (!policyDecision.allowed) {
    const abortedReceipt: AgentRunReceipt = {
      request,
      plan,
      result: {
        outcome: "aborted",
        answer: "KEJI aborted before payment because the task violates policy.",
        verificationSummary: "No execution performed.",
        spendApproved: false,
        totalEstimatedCostUsd: request.estimatedToolCostUsd,
        provider: "simulated",
        providerModel: config.bankr.modelId,
        paidInputProvider: "simulated",
        paidInputSummary: "No paid input was purchased."
      },
      receiptId: crypto.randomUUID(),
      completedAt: new Date().toISOString(),
      proof: null
    };
    await appendLogEntry({
      level: "warn",
      phase: "aborted",
      requestId: request.id,
      message: "Task aborted by spend policy"
    });
    await appendReceipt(abortedReceipt);
    return abortedReceipt;
  }

  if (plan.requiresPaidTool) {
    const purchase = await runAgentCashPurchase(request);
    await appendLogEntry({
      level: "info",
      phase: "tool_purchase_pending",
      requestId: request.id,
      message:
        purchase.provider === "agentcash"
          ? "KEJI is authorizing a real AgentCash x402 purchase"
          : "KEJI would authorize one x402 purchase through AgentCash",
      data: {
        estimatedToolCostUsd: request.estimatedToolCostUsd,
        toolPurpose: plan.toolPurpose,
        provider: purchase.provider,
        endpointUrl: purchase.endpointUrl || undefined
      }
    });
    await appendLogEntry({
      level: "info",
      phase: "tool_purchased",
      requestId: request.id,
      message:
        purchase.provider === "agentcash"
          ? "Completed AgentCash paid request"
          : "Recorded paid-tool purchase intent",
      data: {
        tool: plan.chosenTool,
        estimatedCostUsd: request.estimatedToolCostUsd,
        summary: purchase.summary,
        rawCheckOutput: purchase.rawCheckOutput,
        rawFetchOutput: purchase.rawFetchOutput
      }
    });

    const reasoning = await runBankrReasoning(request, plan);
    await appendLogEntry({
      level: "info",
      phase: "executed",
      requestId: request.id,
      message: `Reasoning provider ${reasoning.provider} produced execution narrative`,
      data: {
        provider: reasoning.provider,
        model: reasoning.model
      }
    });

    const result = executeTask(
      request,
      plan,
      reasoning.content,
      reasoning.provider,
      reasoning.model,
      purchase.provider,
      purchase.summary
    );
    await appendLogEntry({
      level: result.outcome === "completed" ? "info" : "warn",
      phase: "executed",
      requestId: request.id,
      message: result.answer,
      data: {
        verificationSummary: result.verificationSummary,
        totalEstimatedCostUsd: result.totalEstimatedCostUsd,
        provider: result.provider,
        providerModel: result.providerModel,
        paidInputProvider: result.paidInputProvider
      }
    });

    await appendLogEntry({
      level: "info",
      phase: "verified",
      requestId: request.id,
      message: result.verificationSummary
    });

    const receipt: AgentRunReceipt = {
      request,
      plan,
      result,
      receiptId: crypto.randomUUID(),
      completedAt: new Date().toISOString(),
      proof: null
    };
    await maybeAnchorReceipt(receipt);
    await appendReceipt(receipt);
    await recordTaskCosts(receipt);
    return receipt;
  }

  const reasoning = await runBankrReasoning(request, plan);
  await appendLogEntry({
    level: "info",
    phase: "executed",
    requestId: request.id,
    message: `Reasoning provider ${reasoning.provider} produced execution narrative`,
    data: {
      provider: reasoning.provider,
      model: reasoning.model
    }
  });

  const result = executeTask(
    request,
    plan,
    reasoning.content,
    reasoning.provider,
    reasoning.model,
    "simulated",
    "No paid input was required for this task."
  );
  await appendLogEntry({
    level: result.outcome === "completed" ? "info" : "warn",
    phase: "executed",
    requestId: request.id,
    message: result.answer,
    data: {
      verificationSummary: result.verificationSummary,
      totalEstimatedCostUsd: result.totalEstimatedCostUsd,
      provider: result.provider,
      providerModel: result.providerModel,
      paidInputProvider: result.paidInputProvider
    }
  });

  await appendLogEntry({
    level: "info",
    phase: "verified",
    requestId: request.id,
    message: result.verificationSummary
  });

  const receipt: AgentRunReceipt = {
    request,
    plan,
    result,
    receiptId: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
    proof: null
  };
  await maybeAnchorReceipt(receipt);
  await appendReceipt(receipt);
  await recordTaskCosts(receipt);
  return receipt;
}

async function maybeAnchorReceipt(receipt: AgentRunReceipt): Promise<void> {
  if (!(await isStatusReadyForAnchoring())) {
    return;
  }

  const proof = await anchorReceiptOnStatus(receipt);
  receipt.proof = proof;

  await appendLogEntry({
    level: "info",
    phase: "proof_anchored",
    requestId: receipt.request.id,
    message: `Anchored receipt ${receipt.receiptId} on ${proof.network}`,
    data: {
      txHash: proof.txHash,
      contractAddress: proof.contractAddress,
      explorerUrl: proof.explorerUrl,
      receiptHash: proof.receiptHash
    }
  });
}
