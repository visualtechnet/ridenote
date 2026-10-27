/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

// `npm run key:*` manage the saved key in the macOS Keychain, so these run only on a Mac. They use
// throwaway entries (never the real "ridenote-demo-local") and delete them afterwards.
const onMac = process.platform === "darwin";
const SCRIPT = path.join(process.cwd(), "scripts", "keychain.sh");
const WITH_KEY = path.join(process.cwd(), "scripts", "with-keychain.sh");
const KEY_A = "sk-ant-fake-aaaaaaaaaa";
const KEY_B = "sk-ant-fake-bbbbbbbbbbbbbbbbbb";
const suffix = `${process.pid}-${Date.now()}`;
const created: string[] = [];
const service = (name: string) => {
  const svc = `ridenote-test-keys-${name}-${suffix}`;
  created.push(svc);
  return svc;
};

function keychain(svc: string, ...args: string[]) {
  return spawnSync("bash", [SCRIPT, ...args], {
    env: { ...process.env, RIDENOTE_KEYCHAIN_SERVICE: svc },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20_000,
  });
}

/** Runs `key:set` in a pseudo-terminal and types `answer` once the prompt has appeared. */
function setKey(svc: string, answer: string) {
  const script = `(sleep 1.2; printf '%s\\n' '${answer}'; sleep 1.2) | script -q /dev/null bash ${SCRIPT} set`;
  return spawnSync("bash", ["-c", script], {
    env: { ...process.env, RIDENOTE_KEYCHAIN_SERVICE: svc },
    encoding: "utf8",
    timeout: 20_000,
  });
}

/** What a program started by with-keychain.sh would see as its key. */
function keyLength(svc: string) {
  const out = spawnSync("bash", [WITH_KEY, "sh", "-c", "echo ${#ANTHROPIC_API_KEY}"], {
    env: { ...process.env, RIDENOTE_KEYCHAIN_SERVICE: svc },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20_000,
  });
  return Number(out.stdout.trim());
}

afterAll(() => {
  for (const svc of created) {
    spawnSync("security", ["delete-generic-password", "-a", process.env.USER ?? "", "-s", svc]);
  }
});

(onMac ? describe : describe.skip)("scripts/keychain.sh (macOS only)", () => {
  it("prints help listing every command, and with no arguments", () => {
    for (const args of [["help"], []]) {
      const result = keychain(service("help"), ...args);
      expect(result.status).toBe(0);
      for (const command of ["key:status", "key:set", "key:remove", "dev:key"]) {
        expect(result.stdout).toContain(command);
      }
    }
  });

  it("refuses an unknown command with the help text", () => {
    const result = keychain(service("bogus"), "bogus");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown command: bogus");
    expect(result.stderr).toContain("key:status");
  });

  it("status says no key is saved, and how to save one", () => {
    const result = keychain(service("none"), "status");
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/No key is saved yet/);
    expect(result.stdout).toContain("key:set");
  });

  it("set saves a key; status then confirms it without ever printing it", () => {
    const svc = service("set");
    const saved = setKey(svc, KEY_A);
    expect(saved.stdout).toContain("Saved.");
    expect(saved.stdout).not.toContain(KEY_A);

    const status = keychain(svc, "status");
    expect(status.status).toBe(0);
    expect(status.stdout).toMatch(/A key is saved/);
    expect(status.stdout + status.stderr).not.toContain(KEY_A);
    expect(keyLength(svc)).toBe(KEY_A.length);
  });

  it("set replaces an existing key", () => {
    const svc = service("replace");
    setKey(svc, KEY_A);
    expect(keyLength(svc)).toBe(KEY_A.length);
    setKey(svc, KEY_B);
    expect(keyLength(svc)).toBe(KEY_B.length);
  });

  it("set rejects something that is not a key and keeps the old one", () => {
    const svc = service("junk");
    setKey(svc, KEY_A);
    const result = setKey(svc, "not-a-key");
    expect(result.stdout).toMatch(/does not look like an Anthropic key/);
    expect(keyLength(svc)).toBe(KEY_A.length);
  });

  it("set needs a real terminal, and says so instead of hanging", () => {
    const result = keychain(service("notty"), "set");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Terminal app/);
  });

  it("remove deletes the saved key, and is harmless when there is none", () => {
    const svc = service("remove");
    setKey(svc, KEY_A);
    const removed = keychain(svc, "remove");
    expect(removed.status).toBe(0);
    expect(removed.stdout).toMatch(/Removed the saved key/);
    expect(keychain(svc, "status").status).toBe(1);

    const again = keychain(svc, "remove");
    expect(again.status).toBe(0);
    expect(again.stdout).toMatch(/nothing was removed/);
  });
});

describe("key scripts and their documentation", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const readme = readFileSync("README.md", "utf8");
  const keyScripts = Object.keys(pkg.scripts).filter(
    (n) => n === "key" || n.endsWith(":key") || n.startsWith("key:"),
  );

  it("package.json defines every key command", () => {
    expect(keyScripts.sort()).toEqual(
      ["dev:key", "eval:key", "key", "key:remove", "key:set", "key:status", "start:key"].sort(),
    );
  });

  it("every key script runs one of the Keychain scripts", () => {
    for (const name of keyScripts) {
      expect(pkg.scripts[name]).toMatch(/^bash scripts\/(with-keychain|keychain)\.sh/);
    }
  });

  it("the README documents each one", () => {
    for (const name of keyScripts) expect(readme).toContain(`npm run ${name}`);
  });
});
