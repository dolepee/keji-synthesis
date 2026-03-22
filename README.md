# KEJI x402

KEJI x402 is a budget-aware autonomous research agent.

It decides whether a paid task is worth funding, enforces a spend policy, buys the required context through x402, routes reasoning through the Bankr LLM Gateway, completes the task, and anchors a receipt on Status Network.

## Why It Exists

Most agents can call a model, but they still cannot safely operate a budget.

In practice, a human usually has to:

- decide whether a paid input is justified
- provision the payment path
- approve the spend
- reconstruct what happened later

KEJI turns that into a verifiable loop:

```text
request -> plan -> budget check -> x402 purchase -> Bankr reasoning -> verify -> receipt anchor
```

## Public Surface

- Demo dashboard: `https://keji-x402.up.railway.app/demo`
- Report catalog: `https://keji-x402.up.railway.app/reports`
- OpenAPI spec: `https://keji-x402.up.railway.app/openapi.json`
- Agent manifest: `https://keji-x402.up.railway.app/.well-known/agent.json`
- x402 manifest: `https://keji-x402.up.railway.app/.well-known/x402.json`
- Repository: `https://github.com/dolepee/keji-synthesis`

## What KEJI Does

1. Accept a paid research goal.
2. Estimate the cost and enforce policy constraints.
3. Authorize a bounded x402 purchase through AgentCash.
4. Route the task through Bankr for reasoning.
5. Verify the result and write a structured receipt.
6. Anchor the receipt on Status Network.

## Live Proof

### ERC-8004 Identity

- Base Mainnet registration tx:
  `0x1269fb24f59cc7709ee88812e16119d7d45a21b0b7f79667e6c78e459acdd279`

### Status Sepolia

- Receipt registry contract:
  `0x89cf6d586902b8750e6d6e5158c51e838cae7aa0`
- Registry deploy tx:
  `0x6d0f10ea9f13122c9f34ab9b89719ae304ed82a76665195b949fa81088cb0e43`
- Anchored receipts:
  `18`
- Latest anchored receipt tx:
  `0x88a67712578b5e1c73232e6803300509b490eaf83264976461e87da213095749`

### Execution State

- Structured log: `logs/agent_log.json`
- Receipts: `runtime/receipts.json`
- Treasury snapshot: `runtime/treasury.json`
- Synthesis registration record: `runtime/synthesis-registration.json`

## Honest Scope

### Real Now

- live public x402 research surface
- live Bankr-routed reasoning
- live AgentCash purchase flow
- real ERC-8004 registration
- live Status receipt anchoring
- structured logs and stored receipts

### Not Claimed

- production-grade x402 validation
- economics still in validation
- strong recent market demand

That distinction matters. KEJI is being submitted as a budgeted autonomous research loop with receipts, not as a proven self-funding business.

## Repository Structure

```text
src/
  cli.ts                        CLI entry point
  core/                         planner, executor, policy loop
  integrations/                 Bankr, AgentCash, Status
  lib/                          manifest, storage, treasury, synthesis client
  server/                       public demo and x402 service
contracts/
  KejiReceiptRegistry.sol
agent/
  agent.json
logs/
  agent_log.json
runtime/
  receipts.json
  treasury.json
  synthesis-registration.json
submission/
  draft payload, track map, proof inventory, demo script, and generated assets
```

## Run Locally

```bash
npm install
npm run run -- --goal "Evaluate whether a paid research input is justified"
```

For the public service build:

```bash
npm run build
npm start
```

## Key Environment Variables

```bash
BANKR_LLM_KEY=
KEJI_X402_ENDPOINT_URL=https://enrichx402.com/api/exa/answer
KEJI_AGENTCASH_REMOTE_HOST=
KEJI_AGENTCASH_REMOTE_KEY_PATH=
STATUS_PRIVATE_KEY=
STATUS_RECEIPT_REGISTRY_ADDRESS=
```

## Submission Assets

Generated assets for the hackathon submission live in `submission/assets/`:

- `keji-x402-cover.png`
- `keji-x402-screens.png`
- `keji-x402-demo.mp4`

Supporting submission files live in `submission/`:

- draft payload
- track map
- proof inventory
- demo script
- collaboration log

## Submission Positioning

KEJI x402 is packaged around the tracks it can defend honestly:

- Synthesis Open Track
- Best Bankr LLM Gateway Use
- Agents With Receipts — ERC-8004
- Let the Agent Cook
- Status Network

It is intentionally not being positioned around `Agent Services on Base` until payment validation is hardened.
