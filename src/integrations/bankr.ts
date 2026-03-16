import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { config } from "../config.js";
import type { TaskPlan, TaskRequest } from "../types.js";

const execFileAsync = promisify(execFile);

interface BankrChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface BankrReasoningResult {
  content: string;
  provider: "bankr" | "simulated";
  model: string;
}

export function isBankrConfigured(): boolean {
  return Boolean(config.bankr.apiKey);
}

export async function runBankrReasoning(
  request: TaskRequest,
  plan: TaskPlan
): Promise<BankrReasoningResult> {
  if (!isBankrConfigured()) {
    return {
      content: [
        `Simulated Bankr reasoning for goal: ${request.goal}.`,
        `KEJI would compare estimated tool cost ${request.estimatedToolCostUsd} USD against the configured budget.`,
        `It would then justify the spend, use the purchased input, and emit a receipt.`
      ].join(" "),
      provider: "simulated",
      model: config.bankr.modelId
    };
  }

  const response = await requestBankrCompletion(request, plan);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bankr request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as BankrChatResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Bankr response did not include a completion message");
  }

  return {
    content,
    provider: "bankr",
    model: config.bankr.modelId
  };
}

async function requestBankrCompletion(request: TaskRequest, plan: TaskPlan): Promise<Response> {
  let lastError: unknown;
  const payload = buildBankrPayload(request, plan);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetch("https://llm.bankr.bot/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.bankr.apiKey
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000)
      });
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await sleep(1_000 * attempt);
        continue;
      }
    }
  }

  try {
    return await requestBankrCompletionWithCurl(payload);
  } catch (curlError) {
    throw curlError instanceof Error
      ? curlError
      : lastError instanceof Error
        ? lastError
        : new Error(String(lastError));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBankrPayload(request: TaskRequest, plan: TaskPlan): Record<string, unknown> {
  return {
    model: config.bankr.modelId,
    messages: [
      {
        role: "system",
        content:
          "You are KEJI, an autonomous agent CFO. Decide if a paid task is worth funding, state the budget reasoning, and produce one concise execution narrative."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            goal: request.goal,
            requestedBy: request.requestedBy,
            estimatedToolCostUsd: request.estimatedToolCostUsd,
            maxAcceptableSpendUsd: request.maxAcceptableSpendUsd,
            plan
          },
          null,
          2
        )
      }
    ]
  };
}

async function requestBankrCompletionWithCurl(payload: Record<string, unknown>): Promise<Response> {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-sS",
      "--retry",
      "3",
      "--retry-all-errors",
      "--connect-timeout",
      "15",
      "--max-time",
      "30",
      "https://llm.bankr.bot/v1/chat/completions",
      "-H",
      "Content-Type: application/json",
      "-H",
      `X-API-Key: ${config.bankr.apiKey}`,
      "-d",
      JSON.stringify(payload)
    ],
    {
      env: process.env,
      timeout: 20_000
    }
  );

  return new Response(stdout, {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
