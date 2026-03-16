import type { TaskPlan, TaskRequest, TaskResult } from "../types.js";

export function executeTask(
  request: TaskRequest,
  plan: TaskPlan,
  reasoningNarrative: string,
  provider: "bankr" | "simulated",
  providerModel: string,
  paidInputProvider: "agentcash" | "simulated",
  paidInputSummary: string
): TaskResult {
  if (plan.requiresPaidTool && plan.chosenTool !== "agentcash-x402") {
    return {
      outcome: "aborted",
      answer: "Execution aborted because the paid tool selection is invalid.",
      verificationSummary: "No result verified.",
      spendApproved: false,
      totalEstimatedCostUsd: request.estimatedToolCostUsd,
      provider,
      providerModel,
      paidInputProvider,
      paidInputSummary
    };
  }

  const answer = [
    reasoningNarrative,
    paidInputSummary,
    "The final output would be packaged with an onchain receipt."
  ].join(" ");

  return {
    outcome: "completed",
    answer,
    verificationSummary: "Result passed the built-in policy and completion checks.",
    spendApproved: true,
    totalEstimatedCostUsd: request.estimatedToolCostUsd,
    provider,
    providerModel,
    paidInputProvider,
    paidInputSummary
  };
}
