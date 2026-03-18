# KEJI

Autonomous agent CFO for the [Synthesis hackathon](https://synthesis.md/).

KEJI decides when a task is worth paying for, buys data through x402 via AgentCash,
routes reasoning through Bankr LLM gateway, records every decision in a structured
audit log, and anchors proof receipts on Status Network — all within a self-enforced
budget.

## Product Thesis

Most AI agents can reason, but they cannot safely operate a budget.

KEJI gives an agent:

- an onchain identity (ERC-8004 on Base Mainnet)
- a machine-readable capability manifest (`agent/agent.json`)
- a paid-tooling loop (AgentCash x402)
- budget-aware reasoning (Bankr LLM gateway)
- execution guardrails (spend policy, verification)
- verifiable receipts (Status Network Sepolia)
- treasury tracking with self-sustaining economics

This is not a trading bot. It is an agent that can justify a spend,
make the spend, complete the task, and leave an auditable trail — then
track whether the value delivered exceeds the cost incurred.

## Target Tracks

- **Synthesis Open Track** — meta-judged across all partner values
- **Protocol Labs: Let the Agent Cook** — fully autonomous decision loop
- **Protocol Labs: Agents With Receipts (ERC-8004)** — onchain identity + verifiable receipts
- **Bankr: Best Bankr LLM Gateway Use** — real inference routing with self-sustaining economics
- **Status Network: Go Gasless** — deployed contract + gasless receipt anchoring

## Core Loop

```
request → budget check → x402 purchase → Bankr reasoning → execute → verify → anchor receipt → treasury update
```

1. Receive a task goal
2. Plan the task and estimate costs
3. Evaluate spend policy (budget caps, compute limits)
4. Purchase paid data via AgentCash x402 (real USDC payments)
5. Route reasoning through Bankr LLM gateway (Claude via Bankr)
6. Execute the task and verify results
7. Anchor a proof receipt on Status Network (gasless)
8. Update the agent treasury with costs and revenue tracking

## Self-Sustaining Economics

KEJI tracks every dollar spent on inference (Bankr) and data purchases (AgentCash x402),
and measures it against the value delivered. The treasury module provides:

- cumulative Bankr inference costs
- cumulative x402 data spend
- revenue earned from providing KEJI's research as a paid service
- net position (revenue - costs)
- self-sustainability ratio (revenue / costs)

```bash
npm run run -- treasury                    # view treasury state
npm run run -- treasury:record-revenue --source "x402-research-report" --amount 5.00
```

The goal: an agent that pays for its own reasoning by selling the outputs.

## Commands

```bash
# Single task (full loop: plan → budget → pay → reason → execute → anchor)
npm run run -- --goal "Evaluate whether buying a paid research input is justified"

# Batch orchestration (4 diverse tasks, each anchored on Status)
npm run run -- batch

# Treasury report
npm run run -- treasury

# Status proof flow
npm run run -- status:init-wallet
npm run run -- status:deploy
npm run run -- status:anchor-latest

# Synthesis registration
npm run run -- register:preview
npm run run -- register
```

## Local Run

1. Copy `.env.example` to `.env`
2. `npm install`
3. `npm run run -- --goal "Your task here"`

For live integrations, configure:

- `BANKR_LLM_KEY` — Bankr LLM gateway API key
- `KEJI_X402_ENDPOINT_URL` — x402 endpoint (e.g. `https://enrichx402.com/api/exa/answer`)
- `KEJI_AGENTCASH_REMOTE_HOST` + `KEJI_AGENTCASH_REMOTE_KEY_PATH` — SSH to funded wallet
- `STATUS_RECEIPT_REGISTRY_ADDRESS` — deployed receipt registry contract

## Architecture

```
src/
├── cli.ts                          # CLI entry point
├── config.ts                       # Zod-validated environment config
├── types.ts                        # TypeScript interfaces
├── core/
│   ├── keji-agent.ts               # Main orchestration loop
│   ├── planner.ts                  # Task planning
│   ├── executor.ts                 # Task execution
│   └── policy.ts                   # Spend policy enforcement
├── integrations/
│   ├── bankr.ts                    # Bankr LLM gateway (with curl fallback)
│   ├── agentcash.ts                # AgentCash x402 payments (local + SSH)
│   └── status.ts                   # Status Network receipt anchoring
└── lib/
    ├── agent-store.ts              # Manifest, log, receipt persistence
    ├── treasury.ts                 # Revenue/cost tracking
    ├── fs-store.ts                 # File I/O utilities
    ├── paths.ts                    # Path constants
    └── synthesis-client.ts         # Synthesis registration

contracts/
└── KejiReceiptRegistry.sol         # Status Network receipt registry

agent/agent.json                    # Machine-readable agent manifest
logs/agent_log.json                 # Structured audit trail
runtime/receipts.json               # Execution receipts
runtime/treasury.json               # Treasury state
```

## Live Demo

- **Dashboard:** [keji-x402.up.railway.app/demo](https://keji-x402.up.railway.app/demo)
- **Report Catalog:** [keji-x402.up.railway.app/reports](https://keji-x402.up.railway.app/reports)
- **OpenAPI Spec:** [keji-x402.up.railway.app/openapi.json](https://keji-x402.up.railway.app/openapi.json)
- **Agent Identity:** [keji-x402.up.railway.app/.well-known/agent.json](https://keji-x402.up.railway.app/.well-known/agent.json)
- **x402 Bazaar Manifest:** [keji-x402.up.railway.app/.well-known/x402.json](https://keji-x402.up.railway.app/.well-known/x402.json)

## Onchain Artifacts

- **ERC-8004 Registration:** [Base Mainnet tx](https://basescan.org/tx/0x1269fb24f59cc7709ee88812e16119d7d45a21b0b7f79667e6c78e459acdd279)
- **Receipt Registry Contract:** [Status Sepolia](https://sepoliascan.status.network/address/0x89cf6d586902b8750e6d6e5158c51e838cae7aa0)
- **Registry Deployment:** [Status Sepolia tx](https://sepoliascan.status.network/tx/0x6d0f10ea9f13122c9f34ab9b89719ae304ed82a76665195b949fa81088cb0e43)
- **18 Receipt Anchors:** Every task receipt is individually anchored on Status Network Sepolia — [view all on demo dashboard](https://keji-x402.up.railway.app/demo)

## License

MIT
