import { runKejiTask } from "./core/keji-agent.js";
import { appendLogEntry, getLatestReceipt, loadManifest, replaceReceipt } from "./lib/agent-store.js";
import {
  anchorReceiptOnStatus,
  deployStatusReceiptRegistry,
  initStatusWallet
} from "./integrations/status.js";
import { buildRegistrationPayload, registerWithSynthesis } from "./lib/synthesis-client.js";
import { loadTreasury, recordRevenue } from "./lib/treasury.js";
import { startX402Server } from "./server/x402-server.js";
import {
  claimTokenFees,
  isBankrAgentConfigured,
  launchToken as launchTokenBankr,
  loadTokenState as loadTokenStateBankr,
  seedBuy,
  checkTokenStatus
} from "./integrations/bankr-agent.js";
import {
  deployToken as deployClankerToken,
  isClankerConfigured,
  loadTokenState as loadTokenStateClanker
} from "./integrations/clanker-launch.js";

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

  if (command === "serve") {
    startX402Server();
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

  // ─── Token Launch & Fee Claiming ───

  if (command === "token:launch") {
    const name = argv.find((_, i) => argv[i - 1] === "--name") ?? "KEJI";
    const symbol = argv.find((_, i) => argv[i - 1] === "--symbol") ?? "KEJI";
    const imageUrl = argv.find((_, i) => argv[i - 1] === "--image") ?? "";
    const description =
      "The first AI agent that pays for its own brain. " +
      "Every $KEJI trade funds autonomous intelligence — " +
      "swap fees flow back to power Bankr inference, x402 research production, and onchain receipts. " +
      "No VCs. No grants. Just an AI hustling for compute. " +
      "Built by KEJI, the autonomous agent CFO.";
    const useBankr = argv.includes("--bankr");

    if (useBankr) {
      if (!isBankrAgentConfigured()) {
        throw new Error("Bankr Agent API key not configured. Set BANKR_AGENT_API_KEY or BANKR_LLM_KEY.");
      }
      const result = await launchTokenBankr({ name, symbol, description, imageUrl: imageUrl || undefined });
      console.log(JSON.stringify(result, null, 2));
    } else if (isClankerConfigured()) {
      const result = await deployClankerToken({ name, symbol, imageUrl: imageUrl || undefined });
      console.log(JSON.stringify(result, null, 2));
    } else if (isBankrAgentConfigured()) {
      const result = await launchTokenBankr({ name, symbol, description, imageUrl: imageUrl || undefined });
      console.log(JSON.stringify(result, null, 2));
    } else {
      throw new Error(
        "No deployment method available.\n" +
        "  Option A: Set BASE_PRIVATE_KEY (funded wallet on Base) for Clanker v4 direct deploy\n" +
        "  Option B: Set BANKR_AGENT_API_KEY with token deploy enabled at bankr.bot/api\n" +
        "  Option C: Use --bankr flag with BANKR_LLM_KEY"
      );
    }
    return;
  }

  if (command === "token:claim-fees") {
    if (!isBankrAgentConfigured()) {
      throw new Error("Bankr Agent API key not configured.");
    }
    const tokenName = argv.find((_, i) => argv[i - 1] === "--token");
    const result = await claimTokenFees(tokenName);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "token:status") {
    const tokenState = (await loadTokenStateClanker()) ?? (await loadTokenStateBankr());
    if (!tokenState?.launched) {
      console.log("No token launched yet. Run: token:launch");
      return;
    }
    console.log("\n=== $KEJI Token State ===");
    console.log(JSON.stringify(tokenState, null, 2));

    if (isBankrAgentConfigured()) {
      console.log("\n=== Live Status (via Bankr) ===");
      const liveStatus = await checkTokenStatus(tokenState.tokenName);
      console.log(liveStatus);
    }
    return;
  }

  if (command === "token:seed-buy") {
    const tokenState = (await loadTokenStateClanker()) ?? (await loadTokenStateBankr());
    if (!tokenState?.contractAddress) {
      throw new Error("No token contract address. Launch token first.");
    }
    const amount = argv.find((_, i) => argv[i - 1] === "--amount") ?? "0.001";
    const result = await seedBuy(tokenState.contractAddress, amount);
    console.log(result);
    return;
  }

  // ─── Self-Sustaining Economics Demo ───

  if (command === "economics") {
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║     KEJI Self-Sustaining Economics Dashboard     ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    const treasury = await loadTreasury();
    const tokenState = (await loadTokenStateClanker()) ?? (await loadTokenStateBankr());

    console.log("── Treasury ──");
    console.log(`  Total Spent:         $${treasury.totalSpentUsd}`);
    console.log(`  ├ Inference (Bankr): $${treasury.totalInferenceCostUsd}`);
    console.log(`  └ x402 Purchases:    $${treasury.totalX402SpendUsd}`);
    console.log(`  Revenue Earned:      $${treasury.revenueEarnedUsd}`);
    console.log(`  Net Position:        $${treasury.netPositionUsd}`);
    console.log(`  Self-Sustaining:     ${(treasury.selfSustainabilityRatio * 100).toFixed(1)}%`);
    console.log(`  Tasks Completed:     ${treasury.totalTasksCompleted}`);
    console.log(`  Receipts Anchored:   ${treasury.totalReceiptsAnchored}`);

    if (treasury.revenueSourceBreakdown.length > 0) {
      console.log("\n── Revenue Sources ──");
      for (const src of treasury.revenueSourceBreakdown) {
        console.log(`  ${src.source}: $${src.amountUsd} (${src.timestamp})`);
      }
    }

    if (tokenState?.launched) {
      console.log("\n── Token Economics ──");
      console.log(`  Token:               $${tokenState.tokenSymbol} (${tokenState.tokenName})`);
      console.log(`  Contract:            ${tokenState.contractAddress || "pending"}`);
      console.log(`  Chain:               ${tokenState.chain}`);
      console.log(`  Launched:            ${tokenState.launchedAt}`);
      console.log(`  Fees Claimed:        $${tokenState.totalFeesClaimedUsd}`);
      console.log(`  Fee Claims:          ${tokenState.feeClaims.length}`);
    } else {
      console.log("\n── Token Economics ──");
      console.log("  No token launched. Run: token:launch");
    }

    console.log("\n── Flywheel ──");
    const hasToken = tokenState?.launched ?? false;
    const hasRevenue = treasury.revenueEarnedUsd > 0;
    const hasInference = treasury.totalInferenceCostUsd > 0;
    const hasReceipts = treasury.totalReceiptsAnchored > 0;

    console.log(`  [${hasToken ? "✓" : " "}] Token launched (swap fees → revenue)`);
    console.log(`  [${hasInference ? "✓" : " "}] Bankr inference used (revenue → compute)`);
    console.log(`  [${hasReceipts ? "✓" : " "}] Onchain receipts (compute → proof)`);
    console.log(`  [${hasRevenue ? "✓" : " "}] Revenue earned (proof → more compute)`);

    if (hasToken && hasRevenue && hasInference && hasReceipts) {
      console.log("\n  ★ FLYWHEEL ACTIVE — KEJI is self-sustaining!");
    }

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
