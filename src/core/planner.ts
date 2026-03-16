import { config } from "../config.js";
import type { TaskPlan, TaskRequest } from "../types.js";

export function buildTaskPlan(request: TaskRequest): TaskPlan {
  const requiresPaidTool = request.estimatedToolCostUsd > 0;

  return {
    summary: `Assess task value, optionally buy one paid tool, execute the task, then write a receipt.`,
    requiresPaidTool,
    chosenModel: config.defaultModel,
    chosenTool: requiresPaidTool ? "agentcash-x402" : "none",
    toolPurpose: requiresPaidTool
      ? "Purchase the minimum paid input needed to complete the request."
      : "No paid tool required for this request.",
    executionSteps: [
      "Check spend policy against estimated cost.",
      "Use Bankr-routed reasoning to assess task scope.",
      requiresPaidTool ? "Authorize one x402 purchase via AgentCash." : "Skip paid purchase.",
      "Execute the task with the chosen model and purchased context.",
      "Verify the result before emitting a final receipt."
    ]
  };
}
