# KEJI Agent CFO Build Spec

## One-Line Pitch

KEJI is an autonomous agent CFO that decides when work is worth paying for,
buys tools and data itself, executes the task, and leaves verifiable receipts.

## User Story

A human or upstream agent asks KEJI to complete a task that may require paid
inputs. KEJI evaluates the goal, estimates cost, checks budget and policy,
purchases only the data or tool access it needs, completes the task, and emits
an audit trail with onchain proof.

## What KEJI Must Do

### Required

- register an ERC-8004 identity
- expose a machine-readable `agent.json`
- emit structured `agent_log.json`
- route reasoning through Bankr
- pay for at least one x402 resource through AgentCash
- execute at least one real onchain action tied to the task flow
- deploy a contract and send one gasless transaction on Status Network
- implement guardrails before irreversible actions

### Nice to Have

- OpenServ planner + executor split
- tool cost estimation before payment
- result verification step before final receipt
- markdown summary export for demo and judging

### Explicitly Not In Scope

- live GMX perps
- broad multi-chain portfolio management
- Lido treasury primitives
- swap-heavy DeFi demos unless required by the final task

## Product Shape

KEJI has four layers:

1. Identity layer
   - ERC-8004 registration
   - operator wallet binding
   - agent manifest

2. Cognition layer
   - Bankr as model gateway
   - budget-aware planning
   - risk and safety checks

3. Payment layer
   - AgentCash / x402 purchase flow
   - spend policy
   - receipt generation

4. Proof layer
   - Status gasless proof receipt
   - execution logs
   - explorer links

## MVP Demo

1. Register KEJI agent identity.
2. Ask KEJI to perform a paid task.
3. KEJI decides the task is worth spending on.
4. KEJI buys one x402 resource.
5. KEJI produces a result.
6. KEJI writes a receipt to logs.
7. KEJI anchors the receipt on Status.

## Safety Rules

- no spend without budget check
- no spend without explicit task-purpose link
- no irreversible action without dry-run or verification
- log every tool call, retry, and failure
- abort if policy or budget is violated

## Success Criteria

- one clean end-to-end autonomous run
- real paid API/tool use
- real onchain identity artifact
- real Status gasless transaction
- public repo with clear README and proofs

