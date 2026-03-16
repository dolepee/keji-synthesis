import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { config } from "../config.js";
import type {
  AgentManifest,
  SynthesisRegistrationPayload,
  SynthesisRegistrationResponse
} from "../types.js";
import { loadManifest, saveManifest } from "./agent-store.js";
import { paths } from "./paths.js";
import { writeJsonFile, writeTextFile } from "./fs-store.js";

const SYNTHESIS_BASE_URL = "https://synthesis.devfolio.co";
const execFileAsync = promisify(execFile);

export function buildRegistrationPayload(manifest: AgentManifest): SynthesisRegistrationPayload {
  if (!config.humanFullName) {
    throw new Error("Missing KEJI_HUMAN_FULL_NAME");
  }

  return {
    name: manifest.name,
    description: manifest.description,
    image: config.registrationImageUrl || undefined,
    agentHarness: "codex-cli",
    model: "gpt-5",
    humanInfo: {
      name: config.humanFullName,
      email: config.operatorEmail,
      socialMediaHandle: config.humanSocialHandle || undefined,
      background: "builder",
      cryptoExperience: "yes",
      aiAgentExperience: "yes",
      codingComfort: 8,
      problemToSolve:
        "AI agents need a safe, auditable way to decide when work is worth paying for, purchase tools or data, execute the task, and leave verifiable onchain receipts."
    }
  };
}

export async function registerWithSynthesis(): Promise<SynthesisRegistrationResponse> {
  const manifest = await loadManifest();
  const payload = buildRegistrationPayload(manifest);
  const registration = await submitRegistration(payload);
  await persistRegistration(registration);
  return registration;
}

async function submitRegistration(
  payload: SynthesisRegistrationPayload
): Promise<SynthesisRegistrationResponse> {
  try {
    const response = await fetch(`${SYNTHESIS_BASE_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Synthesis registration failed (${response.status}): ${body}`);
    }

    return (await response.json()) as SynthesisRegistrationResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("fetch failed")) {
      throw error;
    }

    const { stdout } = await execFileAsync("curl", [
      "-sS",
      "-X",
      "POST",
      `${SYNTHESIS_BASE_URL}/register`,
      "-H",
      "Content-Type: application/json",
      "--data",
      JSON.stringify(payload)
    ]);
    return JSON.parse(stdout) as SynthesisRegistrationResponse;
  }
}

export async function persistRegistration(
  registration: SynthesisRegistrationResponse
): Promise<void> {
  await writeJsonFile(paths.synthesisRegistration, registration);
  await writeTextFile(paths.synthesisApiKey, registration.apiKey + "\n");

  const manifest = await loadManifest();
  manifest.identity.erc8004 = {
    registered: true,
    address: manifest.identity.erc8004.address,
    txHash: "",
    chain: "Base Mainnet",
    participantId: registration.participantId,
    teamId: registration.teamId,
    registrationExplorerUrl: registration.registrationTxn
  };
  await saveManifest(manifest);
}
