import path from "node:path";

const projectRoot = process.cwd();

export const paths = {
  projectRoot,
  agentManifest: path.join(projectRoot, "agent", "agent.json"),
  agentLog: path.join(projectRoot, "logs", "agent_log.json"),
  docs: path.join(projectRoot, "docs"),
  runtimeDir: path.join(projectRoot, "runtime"),
  receipts: path.join(projectRoot, "runtime", "receipts.json"),
  statusWallet: path.join(projectRoot, "runtime", "status-wallet.json"),
  synthesisRegistration: path.join(projectRoot, "runtime", "synthesis-registration.json"),
  synthesisApiKey: path.join(projectRoot, "runtime", "synthesis-api-key.txt"),
  statusDeployment: path.join(projectRoot, "runtime", "status-deployment.json"),
  statusReceiptRegistryContract: path.join(projectRoot, "contracts", "KejiReceiptRegistry.sol"),
  treasury: path.join(projectRoot, "runtime", "treasury.json")
};
