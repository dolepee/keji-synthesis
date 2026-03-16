export type AgentPhase =
  | "received"
  | "planned"
  | "budget_checked"
  | "tool_purchase_pending"
  | "tool_purchased"
  | "executed"
  | "verified"
  | "proof_anchored"
  | "receipt_written"
  | "aborted";

export type LogLevel = "info" | "warn" | "error";

export interface SpendPolicy {
  maxAutonomousSpendUsd: number;
  computeBudgetUsd: number;
  requiresVerificationBeforeSubmit: boolean;
}

export interface TaskRequest {
  id: string;
  goal: string;
  requestedBy: string;
  category: "paid-research" | "budgeted-execution" | "receipt-generation";
  estimatedToolCostUsd: number;
  maxAcceptableSpendUsd?: number;
}

export interface TaskPlan {
  summary: string;
  requiresPaidTool: boolean;
  chosenModel: string;
  chosenTool: "agentcash-x402" | "none";
  toolPurpose: string;
  executionSteps: string[];
}

export interface TaskResult {
  outcome: "completed" | "aborted";
  answer: string;
  verificationSummary: string;
  spendApproved: boolean;
  totalEstimatedCostUsd: number;
  provider: "bankr" | "simulated";
  providerModel: string;
  paidInputProvider: "agentcash" | "simulated";
  paidInputSummary: string;
}

export interface ReceiptProof {
  provider: "status";
  network: string;
  chainId: number;
  contractAddress: string;
  receiptHash: string;
  txHash: string;
  explorerUrl: string;
  anchoredAt: string;
}

export interface AgentManifest {
  name: string;
  description: string;
  model: {
    primary: string;
    fallback: string | null;
  };
  operatorWallet: {
    address: string;
    chain: string;
  };
  identity: {
    erc8004: {
      registered: boolean;
      address: string;
      txHash: string;
      chain: string;
      participantId?: string;
      teamId?: string;
      registrationExplorerUrl?: string;
    };
  };
  tools: Array<{
    name: string;
    role: string;
    configured: boolean;
  }>;
  taskCategories: string[];
  constraints: {
    computeBudget: string;
    maxAutonomousSpend: string;
    requiresVerificationBeforeSubmit: boolean;
  };
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  phase: AgentPhase;
  requestId: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentLogFile {
  agent: string;
  schemaVersion: string;
  entries: AgentLogEntry[];
}

export interface AgentRunReceipt {
  request: TaskRequest;
  plan: TaskPlan;
  result: TaskResult;
  receiptId: string;
  completedAt: string;
  proof?: ReceiptProof | null;
}

export interface StatusDeployment {
  network: string;
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  txHash: string;
  explorerUrl: string;
  deployedAt: string;
}

export interface StatusWalletBootstrap {
  network: string;
  chainId: number;
  address: string;
  privateKey: `0x${string}`;
  createdAt: string;
}

export interface SynthesisRegistrationPayload {
  name: string;
  description: string;
  image?: string;
  agentHarness: "codex-cli";
  model: string;
  humanInfo: {
    name: string;
    email: string;
    socialMediaHandle?: string;
    background: "builder" | "product" | "designer" | "student" | "founder" | "other";
    cryptoExperience: "yes" | "no" | "a little";
    aiAgentExperience: "yes" | "no" | "a little";
    codingComfort: number;
    problemToSolve: string;
  };
}

export interface SynthesisRegistrationResponse {
  participantId: string;
  teamId: string;
  name: string;
  apiKey: string;
  registrationTxn: string;
}

export interface AgentTreasury {
  totalSpentUsd: number;
  totalInferenceCostUsd: number;
  totalX402SpendUsd: number;
  totalReceiptsAnchored: number;
  totalTasksCompleted: number;
  revenueEarnedUsd: number;
  revenueSourceBreakdown: Array<{
    source: string;
    amountUsd: number;
    timestamp: string;
  }>;
  netPositionUsd: number;
  selfSustainabilityRatio: number;
  updatedAt: string;
}
