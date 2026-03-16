import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { config } from "../config.js";
import type { TaskRequest } from "../types.js";

const execFileAsync = promisify(execFile);
const AGENTCASH_PACKAGE = "agentcash@latest";
const AGENTCASH_TIMEOUT_MS = 60_000;

export interface AgentCashResult {
  provider: "agentcash" | "simulated";
  endpointUrl: string;
  summary: string;
  rawCheckOutput?: string;
  rawFetchOutput?: string;
}

export function isAgentCashConfigured(): boolean {
  return Boolean(config.agentcash.endpointUrl);
}

export function isAgentCashRemoteConfigured(): boolean {
  return Boolean(config.agentcash.remoteHost && config.agentcash.remoteKeyPath);
}

export async function runAgentCashPurchase(request: TaskRequest): Promise<AgentCashResult> {
  if (!isAgentCashConfigured()) {
    return {
      provider: "simulated",
      endpointUrl: "",
      summary: `Simulated x402 purchase intent for ${request.goal} at ${request.estimatedToolCostUsd} USD.`
    };
  }

  const endpointUrl = config.agentcash.endpointUrl;
  const requestSpec = buildRequestSpec(endpointUrl, request);
  const checkOutput = await runAgentCashCommand("check", endpointUrl, requestSpec);
  const fetchOutput = await runAgentCashCommand("fetch", endpointUrl, requestSpec);

  return {
    provider: "agentcash",
    endpointUrl,
    summary: `AgentCash checked and fetched ${endpointUrl} for this task.`,
    rawCheckOutput: checkOutput,
    rawFetchOutput: fetchOutput
  };
}

function buildRequestSpec(endpointUrl: string, request: TaskRequest): {
  method: "GET" | "POST";
  body?: Record<string, unknown>;
} {
  if (endpointUrl.includes("/api/exa/answer")) {
    return {
      method: "POST",
      body: {
        query: request.goal
      }
    };
  }

  return {
    method: "GET"
  };
}

async function runAgentCashCommand(
  command: "check" | "fetch",
  url: string,
  requestSpec: { method: "GET" | "POST"; body?: Record<string, unknown> }
): Promise<string> {
  const args = [
    "--yes",
    AGENTCASH_PACKAGE,
    command,
    url,
    "--method",
    requestSpec.method,
    "--format",
    "json"
  ];

  if (requestSpec.body) {
    args.push("--body", JSON.stringify(requestSpec.body));
  }

  if (command === "fetch") {
    args.push("--payment-method", "x402", "--payment-network", "base");
    args.push("--max-amount", String(config.agentcash.maxAmountUsd));
  }

  const { stdout, stderr } = isAgentCashRemoteConfigured()
    ? await execFileAsync(
        "ssh",
        [
          "-i",
          config.agentcash.remoteKeyPath,
          config.agentcash.remoteHost,
          buildRemoteCommand(args)
        ],
        {
          env: process.env,
          timeout: AGENTCASH_TIMEOUT_MS
        }
      )
    : await execFileAsync("npx", args, {
        env: process.env,
        timeout: AGENTCASH_TIMEOUT_MS
      });
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  if (!combined) {
    throw new Error(`AgentCash ${command} returned no output`);
  }
  return combined;
}

function buildRemoteCommand(args: string[]): string {
  return ["npx", ...args].map(shellEscape).join(" ");
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
