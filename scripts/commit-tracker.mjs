// Builds commit-tracker.html: every commit on every branch, who made it, and whether its message
// carries AI or co-author attribution. Run with `npm run commits`; the output is git-ignored
// because it lists author emails.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "commit-tracker.html";
const TEMPLATE = new URL("./commit-tracker.template.html", import.meta.url);

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });

const AI_NAMES = /claude|anthropic|copilot|chatgpt|openai|gpt-?\d|gemini|codex|cursor|aider/i;
const AI_WORDS = /\b(claude|anthropic|chatgpt|openai|copilot|gemini|codex|cursor|aider)\b/i;

// Lines that attribute the commit to someone or something other than the committer.
const ATTRIBUTION_LINES = [
  { label: "Co-authored-by trailer", test: /^\s*co-authored-by:/i },
  { label: "Signed-off-by trailer", test: /^\s*signed-off-by:/i },
  { label: "“Generated with/by” line", test: /generated\s+(with|by)\b/i },
  { label: "Robot emoji", test: /🤖/u },
  { label: "Anthropic noreply address", test: /noreply@anthropic\.com/i },
];

const defaultBranch = () => {
  try {
    return git("symbolic-ref", "--short", "refs/remotes/origin/HEAD")
      .trim()
      .replace(/^origin\//, "");
  } catch {
    return "main";
  }
};

// hash -> Set of branch names, with origin/x folded into x.
const branchMap = () => {
  const refs = git("for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes")
    .split("\n")
    .filter((ref) => ref && !ref.endsWith("/HEAD") && ref !== "origin");
  const byHash = new Map();
  for (const ref of refs) {
    const name = ref.replace(/^origin\//, "");
    for (const hash of git("rev-list", ref).split("\n").filter(Boolean)) {
      if (!byHash.has(hash)) byHash.set(hash, new Set());
      byHash.get(hash).add(name);
    }
  }
  return byHash;
};

const readCommits = () => {
  const format = ["%H", "%an", "%ae", "%cn", "%ce", "%aI", "%B"].join("%x1f");
  return git("log", "--all", `--format=${format}%x1e`)
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, an, ae, cn, ce, date, message] = record.split("\x1f");
      return { hash, an, ae, cn, ce, date, message: message.trim() };
    });
};

// A sign-off by the commit's own author (Dependabot adds its own) is not attribution to anyone else.
const isOwnSignOff = (text, commit) =>
  /^\s*signed-off-by:/i.test(text) &&
  [commit.an, commit.ae].some((who) => text.toLowerCase().includes(who.toLowerCase()));

const findings = (commit) => {
  const found = [];
  commit.message.split("\n").forEach((text, line) => {
    const strong = isOwnSignOff(text, commit)
      ? undefined
      : ATTRIBUTION_LINES.find(({ test }) => test.test(text));
    if (strong) {
      found.push({ level: "attributed", label: strong.label, line });
      return;
    }
    const mention = text.match(AI_WORDS);
    if (mention) found.push({ level: "mention", label: `Mentions “${mention[1]}”`, line });
  });
  if (AI_NAMES.test(`${commit.an} ${commit.ae}`)) {
    found.push({ level: "attributed", label: "Author identity looks like an AI tool", line: -1 });
  }
  if (AI_NAMES.test(`${commit.cn} ${commit.ce}`)) {
    found.push({
      level: "attributed",
      label: "Committer identity looks like an AI tool",
      line: -1,
    });
  }
  return found;
};

// Addresses never reach the page; the attribution lines still read, with the address hidden.
const redact = (text) => text.replace(/<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?/g, "‹email hidden›");

const build = () => {
  const selfName = git("config", "user.name").trim().toLowerCase();
  const commits = readCommits();
  const selfEmails = new Set(
    commits.filter((c) => c.an.toLowerCase() === selfName).map((c) => c.ae.toLowerCase()),
  );
  const branches = branchMap();
  const main = defaultBranch();

  // "you" matches by name or by any email you have committed under; GitHub's web committer is neutral.
  const roleOf = (name, email) => {
    if (AI_NAMES.test(`${name} ${email}`)) return "ai";
    if (/\[bot\]/i.test(`${name} ${email}`)) return "bot";
    if (email.toLowerCase() === "noreply@github.com") return "github";
    if (name.toLowerCase() === selfName || selfEmails.has(email.toLowerCase())) return "you";
    return "other";
  };

  const rows = commits.map((c) => {
    const found = findings(c);
    const message = redact(c.message);
    const where = [...(branches.get(c.hash) ?? [])].sort();
    return {
      hash: c.hash,
      date: c.date,
      author: c.an,
      committer: c.cn,
      // Neither you, a bot, nor GitHub's web committer: the "unintended commit" signal, no identity shown.
      unexpected: [roleOf(c.an, c.ae), roleOf(c.cn, c.ce)].some((r) => r === "other" || r === "ai"),
      message,
      subject: message.split("\n")[0],
      branches: where,
      inMain: where.includes(main),
      findings: found,
      status: found.some((f) => f.level === "attributed")
        ? "attributed"
        : found.length
          ? "mention"
          : "clean",
    };
  });

  return {
    repo: git("rev-parse", "--show-toplevel").trim().split("/").pop(),
    generated: new Date().toISOString(),
    main,
    commits: rows,
  };
};

// Commit text is untrusted: keep it from closing the script tag or breaking out as markup.
const embed = (data) =>
  JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/[\u2028\u2029]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16)}`);

const PLACEHOLDER = /\/\*__DATA__\*\/\s*null/;
const template = readFileSync(TEMPLATE, "utf8");
if (!PLACEHOLDER.test(template)) throw new Error("commit-tracker.template.html lost its data slot");

const data = build();
writeFileSync(
  OUT,
  template.replace(PLACEHOLDER, () => embed(data)),
);

const flagged = data.commits.filter((c) => c.status === "attributed");
const inMain = flagged.filter((c) => c.inMain);
console.log(
  `${OUT}: ${data.commits.length} commits, ${flagged.length} with attribution (${inMain.length} in ${data.main}).`,
);
