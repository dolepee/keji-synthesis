# KEJI Implementation Status

## Built Now

- runnable TypeScript KEJI CLI
- spend-policy enforcement
- task planner and executor loop
- manifest syncing into `agent/agent.json`
- structured log writing into `logs/agent_log.json`
- Synthesis registration client and response persistence
- Bankr integration path with live-call support when `BANKR_LLM_KEY` is present
- curl fallback and retry hardening for Bankr when direct fetch is flaky
- AgentCash x402 path with live CLI support when `KEJI_X402_ENDPOINT_URL` is present
- optional SSH-backed AgentCash execution so KEJI can use the funded OpenClaw VPS wallet
- Status receipt registry contract
- Status deployment + anchoring commands
- receipt persistence in `runtime/receipts.json`

## Live Right Now

- Synthesis registration
- Bankr LLM reasoning when credits are available
- AgentCash x402 purchase flow against the funded OpenClaw VPS wallet

## Not Live Yet

- first Status testnet deployment and receipt anchor
- OpenServ planner/executor split
- ERC-8004 explorer parsing beyond the registration metadata already saved

## Live Commands

- `npm run run -- --goal "..."` to run the local KEJI loop
- `npm run run -- register:preview` to inspect the exact Synthesis registration payload
- `npm run run -- register` to submit the real Synthesis registration
- `npm run run -- status:init-wallet` to generate a dedicated Status testnet wallet in `runtime/status-wallet.json`
- `npm run run -- status:deploy` to deploy the receipt registry on Status
- `npm run run -- status:anchor-latest` to anchor the latest stored receipt on Status

## Current Blocking Inputs

- funded Status testnet wallet private key in `STATUS_PRIVATE_KEY` or a funded generated wallet from `status:init-wallet`
- deployed registry address in `STATUS_RECEIPT_REGISTRY_ADDRESS`

## Next High-Value Build Steps

1. Deploy the Status receipt registry and anchor the first live KEJI receipt.
2. Split planner/executor into an OpenServ-backed flow.
3. Add richer receipt exports for the submission package.
