import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const submissionDir = path.join(root, "submission");
const outputFile = path.join(submissionDir, "keji-x402.project.json");
const registrationFile = path.join(root, "runtime", "synthesis-registration.json");
const assetRef = process.env.SYNTHESIS_ASSET_REF || "main";
const assetBaseUrl = `https://cdn.jsdelivr.net/gh/dolepee/keji-synthesis@${assetRef}/submission/assets`;

const trackUUIDs = [
  "fdb76d08812b43f6a5f454744b66f590",
  "dcaf0b1bf5d44c72a34bb771008e137a",
  "3bf41be958da497bbb69f1a150c76af9",
  "10bd47fac07e4f85bda33ba482695b24",
  "877cd61516a14ad9a199bf48defec1c1",
];

async function readText(name) {
  return readFile(path.join(submissionDir, name), "utf8");
}

async function resolveTeamUUID() {
  if (process.env.SYNTHESIS_TEAM_UUID) {
    return process.env.SYNTHESIS_TEAM_UUID;
  }

  const raw = await readFile(registrationFile, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.teamId) {
    throw new Error("Missing teamId in synthesis registration file.");
  }

  return parsed.teamId;
}

const payload = {
  teamUUID: await resolveTeamUUID(),
  name: "KEJI x402",
  description: (await readText("keji-x402-description.md")).trim(),
  problemStatement: (await readText("keji-x402-problem-statement.md")).trim(),
  repoURL: "https://github.com/dolepee/keji-synthesis",
  trackUUIDs,
  conversationLog: (await readText("keji-x402-conversation-log.md")).trim(),
  submissionMetadata: {
    agentFramework: "other",
    agentFrameworkOther: "custom TypeScript autonomous CLI with Bankr and x402 integrations",
    agentHarness: "codex-cli",
    model: "gpt-5",
    skills: ["keji-research-reports"],
    tools: [
      "TypeScript",
      "Bankr LLM Gateway",
      "AgentCash",
      "Status Network",
      "Railway",
      "Base",
    ],
    helpfulResources: [
      "https://docs.bankr.bot/llm-gateway/overview/",
      "https://docs.bankr.bot/openclaw/installation",
      "https://synthesis.devfolio.co/submission/skill.md",
    ],
    helpfulSkills: [
      {
        name: "keji-research-reports",
        reason:
          "Kept the packaging grounded to the live KEJI research surface and its actual x402 delivery model instead of drifting into a generic agent-services pitch.",
      },
    ],
    intention: "continuing",
    intentionNotes:
      "Next work is to harden x402 payment verification and improve the economics layer so KEJI can evolve from a hackathon prototype into a defensible paid agent service.",
  },
  deployedURL: "https://keji-x402.up.railway.app/demo",
  videoURL: `${assetBaseUrl}/keji-x402-demo.mp4`,
  pictures: `${assetBaseUrl}/keji-x402-screens.png`,
  coverImageURL: `${assetBaseUrl}/keji-x402-cover.png`,
};

if (process.env.SYNTHESIS_VIDEO_URL) {
  payload.videoURL = process.env.SYNTHESIS_VIDEO_URL;
}

if (process.env.SYNTHESIS_PICTURES_URL) {
  payload.pictures = process.env.SYNTHESIS_PICTURES_URL;
}

if (process.env.SYNTHESIS_COVER_IMAGE_URL) {
  payload.coverImageURL = process.env.SYNTHESIS_COVER_IMAGE_URL;
}

await mkdir(submissionDir, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${outputFile}`);
