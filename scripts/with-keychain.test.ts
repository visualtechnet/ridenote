/** @jest-environment node */
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

// The helper reads and writes the macOS Keychain, so these run only on a Mac. They use throwaway
// entries (never the real "ridenote-demo-local") and delete them afterwards.
const onMac = process.platform === "darwin";
const SCRIPT = path.join(process.cwd(), "scripts", "with-keychain.sh");
const FAKE_KEY = "sk-ant-fake-0123456789_abc";
const suffix = `${process.pid}-${Date.now()}`;
const service = (name: string) => `ridenote-test-${name}-${suffix}`;
const created: string[] = [];

/** Runs the helper inside a pseudo-terminal and types `answer` once the prompt has appeared. */
function runWithTerminal(svc: string, answer: string, command: string) {
  created.push(svc);
  const script = `(sleep 1.2; printf '%s\\n' '${answer}'; sleep 1.2) | script -q /dev/null bash ${SCRIPT} ${command}`;
  return spawnSync("bash", ["-c", script], {
    env: { ...process.env, RIDENOTE_KEYCHAIN_SERVICE: svc },
    encoding: "utf8",
    timeout: 20_000,
  });
}

function run(svc: string, command: string[]) {
  created.push(svc);
  return spawnSync("bash", [SCRIPT, ...command], {
    env: { ...process.env, RIDENOTE_KEYCHAIN_SERVICE: svc },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20_000,
  });
}

afterAll(() => {
  for (const svc of created) {
    spawnSync("security", ["delete-generic-password", "-a", process.env.USER ?? "", "-s", svc]);
  }
});

(onMac ? describe : describe.skip)("scripts/with-keychain.sh (macOS only)", () => {
  it("refuses politely, and does not hang, when there is no key and no terminal", () => {
    const result = run(service("none"), ["true"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Terminal app/);
  });

  it("asks once, saves the key, runs the command with it, and never asks again", () => {
    const svc = service("first");
    const first = runWithTerminal(svc, FAKE_KEY, `sh -c 'echo len=$\{#ANTHROPIC_API_KEY}'`);
    expect(first.stdout).toContain("First time here");
    expect(first.stdout).toContain("Saved.");
    expect(first.stdout).toContain(`len=${FAKE_KEY.length}`);
    expect(first.stdout).not.toContain(FAKE_KEY); // the key is never printed

    const second = run(svc, ["sh", "-c", "echo len=${#ANTHROPIC_API_KEY}"]);
    expect(second.status).toBe(0);
    expect(second.stdout.trim()).toBe(`len=${FAKE_KEY.length}`);
    expect(second.stdout).not.toContain("First time here");
  });

  it("rejects something that is not an Anthropic key and saves nothing", () => {
    const svc = service("junk");
    const result = runWithTerminal(svc, "not-a-key", "true");
    expect(result.stdout).toMatch(/does not look like an Anthropic key/);
    expect(() =>
      execFileSync("security", ["find-generic-password", "-a", process.env.USER ?? "", "-s", svc], {
        stdio: "ignore",
      }),
    ).toThrow();
  });
});
