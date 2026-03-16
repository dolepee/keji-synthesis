import { runKejiTask } from "./core/keji-agent.js";
import { appendLogEntry, getLatestReceipt, loadManifest, replaceReceipt } from "./lib/agent-store.js";
import {
  anchorReceiptOnStatus,
  deployStatusReceiptRegistry,
  initStatusWallet
} from "./integrations/status.js";
import { buildRegistrationPayload, registerWithSynthesis } from "./lib/synthesis-client.js";
import { loadTreasury, recordRevenue } from "./lib/treasury.js";

function parseCommand(argv: string[]): string {
  const positional = argv.filter((value) => !value.startsWith("-"));
  return positional[0] ?? "run";
}

function parseGoal(argv: string[]): string {
  const goalFlagIndex = argv.findIndex((value) => value === "--goal");
  if (goalFlagIndex >= 0 && argv[goalFlagIndex + 1]) {
    return argv[goalFlagIndex + 1];
  }

  const positional = argv.filter((value) => !value.startsWith("-"));
  if (positional[0] === "run" && positional[1]) {
    return positional.slice(1).join(" ");
  }

  if (positional[0]) {
    return positional.join(" ");
  }

  return "Evaluate whether a paid research task is worth funding.";
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = parseCommand(argv);

  if (command === "register:preview") {
    const manifest = await loadManifest();
    const payload = buildRegistrationPayload(manifest);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (command === "register") {
    const registration = await registerWithSynthesis();
    console.log(JSON.stringify(registration, null, 2));
    return;
  }

  if (command === "status:deploy") {
    const deployment = await deployStatusReceiptRegistry();
    console.log(JSON.stringify(deployment, null, 2));
    return;
  }

  if (command === "status:init-wallet") {
    const wallet = await initStatusWallet();
    console.log(
      JSON.stringify(
        {
          network: wallet.network,
          chainId: wallet.chainId,
          address: wallet.address,
          createdAt: wallet.createdAt
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "status:anchor-latest") {
    const latestReceipt = await getLatestReceipt();

    if (!latestReceipt) {
      throw new Error("No stored receipts found. Run KEJI once before anchoring.");
    }

    const proof = await anchorReceiptOnStatus(latestReceipt);
    latestReceipt.proof = proof;
    await replaceReceipt(latestReceipt);
    await appendLogEntry({
      level: "info",
      phase: "proof_anchored",
      requestId: latestReceipt.request.id,
      message: `Anchored latest receipt ${latestReceipt.receiptId} on ${proof.network}`,
      data: { ...proof }
    });
    console.log(JSON.stringify(latestReceipt, null, 2));
    return;
  }

  if (command === "batch") {
    const goals = [
      "Research the current state of gasless transaction infrastructure on Status Network and compare it to EIP-4337 account abstraction approaches for agent-native wallets",
      "Analyze the ROI of using x402 pay-per-request APIs versus traditional API key subscriptions for autonomous AI agents that operate 24/7",
      "Evaluate Bankr LLM gateway model routing strategies: when should an agent CFO choose Claude over GPT for budget-constrained reasoning tasks",
      "Assess the security model of ERC-8004 agent identity registries and how they enable trust between autonomous agents transacting onchain"
    ];

    console.log(`\n=== KEJI Batch Orchestration: ${goals.length} tasks ===\n`);
    const results = [];

    for (let i = 0; i < goals.length; i += 1) {
      console.log(`\n--- Task ${i + 1}/${goals.length} ---`);
      console.log(`Goal: ${goals[i]}\n`);
      const receipt = await runKejiTask(goals[i]);
      results.push(receipt);
      console.log(`Status: ${receipt.result.outcome}`);
      console.log(`Provider: ${receipt.result.provider} (${receipt.result.providerModel})`);
      console.log(`Paid input: ${receipt.result.paidInputProvider}`);
      if (receipt.proof) {
        console.log(`Proof: ${receipt.proof.explorerUrl}`);
      }
    }

    const treasury = await loadTreasury();
    console.log("\n=== KEJI Treasury Report ===");
    console.log(JSON.stringify(treasury, null, 2));
    return;
  }

  if (command === "treasury") {
    const treasury = await loadTreasury();
    console.log(JSON.stringify(treasury, null, 2));
    return;
  }

  if (command === "treasury:record-revenue") {
    const source = argv.find((_, i) => argv[i - 1] === "--source") ?? "x402-service";
    const amount = parseFloat(argv.find((_, i) => argv[i - 1] === "--amount") ?? "0");
    if (amount <= 0) {
      throw new Error("Revenue amount must be positive. Usage: treasury:record-revenue --source <source> --amount <usd>");
    }
    const treasury = await recordRevenue(source, amount);
    console.log(JSON.stringify(treasury, null, 2));
    return;
  }

  const goal = parseGoal(argv);
  const receipt = await runKejiTask(goal);
  console.log(JSON.stringify(receipt, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
