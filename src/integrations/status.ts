import fs from "node:fs/promises";

import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
  type Chain,
  type Hex
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { config } from "../config.js";
import { paths } from "../lib/paths.js";
import { readJsonFileOrDefault, writeJsonFile } from "../lib/fs-store.js";
import type {
  AgentRunReceipt,
  ReceiptProof,
  StatusDeployment,
  StatusWalletBootstrap
} from "../types.js";

interface SolcOutput {
  contracts?: Record<
    string,
    Record<
      string,
      {
        abi: Abi;
        evm: {
          bytecode: {
            object: string;
          };
        };
      }
    >
  >;
  errors?: Array<{
    severity: "error" | "warning";
    formattedMessage: string;
  }>;
}

interface CompiledContract {
  abi: Abi;
  bytecode: Hex;
}

export async function isStatusConfigured(): Promise<boolean> {
  return Boolean(await resolveStatusPrivateKey());
}

export async function isStatusReadyForAnchoring(): Promise<boolean> {
  return Boolean((await resolveStatusPrivateKey()) && config.status.receiptRegistryAddress);
}

export async function loadStatusDeployment(): Promise<StatusDeployment | null> {
  return readJsonFileOrDefault<StatusDeployment | null>(paths.statusDeployment, null);
}

export async function loadStatusWallet(): Promise<StatusWalletBootstrap | null> {
  return readJsonFileOrDefault<StatusWalletBootstrap | null>(paths.statusWallet, null);
}

export async function initStatusWallet(): Promise<StatusWalletBootstrap> {
  const existingWallet = await loadStatusWallet();

  if (existingWallet) {
    return existingWallet;
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const wallet: StatusWalletBootstrap = {
    network: config.status.networkName,
    chainId: config.status.chainId,
    address: account.address,
    privateKey,
    createdAt: new Date().toISOString()
  };

  await writeJsonFile(paths.statusWallet, wallet);
  return wallet;
}

export async function deployStatusReceiptRegistry(): Promise<StatusDeployment> {
  const privateKey = await resolveStatusPrivateKeyOrThrow();

  const contract = await compileReceiptRegistry();
  const chain = getStatusChain();
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain,
    transport: http(config.status.rpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.status.rpcUrl)
  });

  const txHash = await walletClient.deployContract({
    abi: contract.abi,
    bytecode: contract.bytecode
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (!receipt.contractAddress) {
    throw new Error("Status deployment receipt did not include a contract address");
  }

  const deployment: StatusDeployment = {
    network: config.status.networkName,
    chainId: config.status.chainId,
    rpcUrl: config.status.rpcUrl,
    contractAddress: receipt.contractAddress,
    txHash,
    explorerUrl: buildExplorerUrl(txHash),
    deployedAt: new Date().toISOString()
  };

  await writeJsonFile(paths.statusDeployment, deployment);
  return deployment;
}

export async function anchorReceiptOnStatus(receipt: AgentRunReceipt): Promise<ReceiptProof> {
  const privateKey = await resolveStatusPrivateKeyOrThrow();
  ensureStatusAnchoringReady();

  const contract = await compileReceiptRegistry();
  const chain = getStatusChain();
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain,
    transport: http(config.status.rpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.status.rpcUrl)
  });
  const receiptHash = computeReceiptHash(receipt);
  const summary = truncate(receipt.result.answer.replace(/\s+/g, " ").trim(), 240);

  const txHash = await walletClient.writeContract({
    address: config.status.receiptRegistryAddress as Address,
    abi: contract.abi,
    functionName: "anchorReceipt",
    args: [receiptHash, receipt.receiptId, receipt.request.id, receipt.result.provider, summary]
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    provider: "status",
    network: config.status.networkName,
    chainId: config.status.chainId,
    contractAddress: config.status.receiptRegistryAddress as Address,
    receiptHash,
    txHash,
    explorerUrl: buildExplorerUrl(txHash),
    anchoredAt: new Date().toISOString()
  };
}

export function computeReceiptHash(receipt: AgentRunReceipt): Hex {
  const canonical = JSON.stringify(
    {
      receiptId: receipt.receiptId,
      requestId: receipt.request.id,
      goal: receipt.request.goal,
      provider: receipt.result.provider,
      providerModel: receipt.result.providerModel,
      paidInputProvider: receipt.result.paidInputProvider,
      paidInputSummary: receipt.result.paidInputSummary,
      completedAt: receipt.completedAt
    },
    null,
    2
  );

  return keccak256(stringToHex(canonical));
}

async function resolveStatusPrivateKey(): Promise<Hex | null> {
  if (config.status.privateKey) {
    return normalizePrivateKey(config.status.privateKey);
  }

  const wallet = await loadStatusWallet();
  return wallet?.privateKey ?? null;
}

async function resolveStatusPrivateKeyOrThrow(): Promise<Hex> {
  const privateKey = await resolveStatusPrivateKey();

  if (!privateKey) {
    throw new Error(
      "Status integration is not configured. Run `npm run run -- status:init-wallet` or set STATUS_PRIVATE_KEY first."
    );
  }

  return privateKey;
}

function ensureStatusAnchoringReady(): void {
  if (!config.status.receiptRegistryAddress) {
    throw new Error(
      "Status proof anchoring is not configured. Deploy the registry first and set STATUS_RECEIPT_REGISTRY_ADDRESS."
    );
  }
}

function getStatusChain(): Chain {
  return defineChain({
    id: config.status.chainId,
    name: config.status.networkName,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [config.status.rpcUrl]
      },
      public: {
        http: [config.status.rpcUrl]
      }
    },
    blockExplorers: {
      default: {
        name: "Status Explorer",
        url: config.status.explorerBaseUrl
      }
    },
    testnet: true
  });
}

async function compileReceiptRegistry(): Promise<CompiledContract> {
  const source = await fs.readFile(paths.statusReceiptRegistryContract, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "KejiReceiptRegistry.sol": {
        content: source
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const errors = output.errors?.filter((error) => error.severity === "error") ?? [];

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.formattedMessage).join("\n\n"));
  }

  const contract = output.contracts?.["KejiReceiptRegistry.sol"]?.KejiReceiptRegistry;

  if (!contract?.evm.bytecode.object) {
    throw new Error("Failed to compile KejiReceiptRegistry");
  }

  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}` as Hex
  };
}

function normalizePrivateKey(value: string): Hex {
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}

function buildExplorerUrl(txHash: Hex): string {
  return `${config.status.explorerBaseUrl}/tx/${txHash}`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
