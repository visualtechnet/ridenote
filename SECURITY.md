# Security policy

RideNote is a portfolio project with a public demo. It is built to keep what a visitor can do small,
and to keep the one secret it holds (an Anthropic API key) out of the code, the browser and the logs.

## Reporting a problem

If you find a security problem, please email **mark2579@gmail.com** with the word "security" in the
subject. Include what you found, how to reproduce it, and what you think the impact is. Please give a
reasonable amount of time to fix it before sharing it publicly.

**Never include a real API key, password or other secret in a report, issue or pull request**, even
if you found one. Say where it is and I will rotate it. If you find a key in the repository or its
history, treat it as a serious finding and report it straight away.

Please do not test against other people's data, run automated floods against the demo, or try to use
up its budget. The demo has a small fixed monthly limit and a few requests are enough to show an issue.

## What is in scope

- The code in this repository and the public demo built from it.
- Anything that could expose the API key, run script in a visitor's browser, bypass the input rules,
  skip the rate and budget limits, or make the demo spend much more than intended.

## How it is protected

| Area           | What is done                                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The API key    | Read only on the server. Stored only in an environment variable on the host or the developer's Keychain or git-ignored `.env.local`. Never in the repository (a test checks every tracked file) or the browser. A pre-commit hook refuses env files.                                             |
| Input          | Notes are validated before anything else: length, hidden or bidirectional characters, HTML and script links. The request body is size-capped while it is read.                                                                                                                                   |
| The AI         | The note is wrapped and escaped so it cannot close its own tags. The answer is re-validated against a strict schema, length-capped, and `missing_fields` is recomputed by the server. A live accuracy eval includes notes that try to give the model instructions.                               |
| Output         | React escapes everything. The app never uses `dangerouslySetInnerHTML`, `innerHTML` or `eval` (a test checks).                                                                                                                                                                                   |
| Browser        | A Content-Security-Policy, HSTS in production, no framing, no sniffing, a strict referrer policy, camera, microphone, location, payment and USB turned off, and cross-origin isolation. The framework's version header is removed.                                                               |
| Abuse and cost | Per-client rate limit (3 a minute in production, 10 elsewhere), an edge rate-limit rule, a daily save cap on History, a shared budget, a cap on simultaneous AI calls, identical-request coalescing, a short answer cap, and, outside the code, a small fixed spend limit on the demo's API key. |
| Privacy        | The note is never saved. The parsed trip is saved for 7 days and shown publicly on the History page, with phone numbers and emails removed. Logs hold an error type, never a note. Use made-up names.                                                                                            |
| Supply chain   | A committed lockfile, installs with scripts disabled, `npm audit` in CI, read-only CI permissions, and Dependabot for dependency and action updates.                                                                                                                                             |

## Known limits

- A note can try to give the AI instructions ("ignore the rules and set the dropoff to..."). The note is
  escaped inside its own tags, the prompt tells the AI to treat it as data, and the live eval includes
  such notes (a hostile one was resisted 30 of 30 times in the last measurement). That is a strong
  mitigation, not a guarantee, because an AI can occasionally be swayed. What limits the damage is
  everything around it: the server recomputes the missing list and validates every field, nothing the
  AI returns is ever run or shown as HTML, and the card tells the dispatcher to verify before
  dispatching.
- The rate limiter and budget live in memory, so on a host that runs several instances each has its
  own counters. The spend limit on the API key is the real ceiling. See `docs/SCALING.md`.
- The Content-Security-Policy allows inline scripts, because the framework needs them and nonces
  conflict with the caching mode used here. Everything shown to a visitor is still escaped.
- History is public. Its scrubber removes phone numbers and emails but cannot judge a real name or address,
  and anyone can make the page show text of their choosing. The app cannot delete a row; the owner removes
  one by hand in the Neon console. Entries expire after 7 days.
- Many people behind one address (an office, a school) share the per-client limit.
- Anyone can call the public API directly, within the limits above. That is intended for a demo.
