import type { SpendPolicy, TaskRequest } from "../types.js";

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
}

export function evaluateSpendPolicy(request: TaskRequest, policy: SpendPolicy): PolicyDecision {
  const taskCap = request.maxAcceptableSpendUsd ?? policy.maxAutonomousSpendUsd;

  if (request.estimatedToolCostUsd > taskCap) {
    return {
      allowed: false,
      reason: `Estimated spend ${request.estimatedToolCostUsd} exceeds task cap ${taskCap}`
    };
  }

  if (request.estimatedToolCostUsd > policy.computeBudgetUsd) {
    return {
      allowed: false,
      reason: `Estimated spend ${request.estimatedToolCostUsd} exceeds compute budget ${policy.computeBudgetUsd}`
    };
  }

  if (!request.goal.trim()) {
    return {
      allowed: false,
      reason: "Task goal is empty"
    };
  }

  return {
    allowed: true,
    reason: "Spend is within configured policy"
  };
}
