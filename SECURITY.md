# Security Policy

Hoo Browser is an experimental browser, not a hardened daily driver yet. This
document explains how to report security issues and what Hoo does and does not
claim to protect against.

## Supported versions

Only the latest commit on `main` receives security fixes. There are no LTS
branches.

| Version | Status |
| --- | --- |
| `main` (0.2.x) | Active development |

## Reporting a vulnerability

Do **not** open a public issue for anything that could expose users.

1. Email **imranshiundu@gmail.com** with subject `[Hoo Browser Security]`.
2. Include: affected component (`src/main`, `src/preload`, `src/renderer`),
   reproduction steps, and an assessment of impact.
3. You will get an acknowledgment within 7 days and a fix plan within 30 days.

Once a fix ships, the reporter is credited in the release notes (unless they
prefer to stay anonymous).

## In scope

- Anything that breaks the isolation promises in `src/main`:
  - `network-policy.ts` — request blocking and low-data rules
  - `privacy-filters.ts` — tracker/ad blocking, third-party header stripping
  - `storage.ts` — profile persistence, encrypted legacy profile reads
  - `auth.ts` / `protocols.ts` — external protocol and auth flows
- IPC surface between `src/preload` and the main process (injection, spoofing,
  privilege confusion between renderer and main).
- Web-app partition isolation (one app profile reading another's storage).
- Download handling (`download-manager.ts`): path traversal, unsafe defaults.
- Update/install scripts (`scripts/install-hoo.sh`, `scripts/update-hoo.sh`).

## Out of scope

- Chromium engine vulnerabilities — report those upstream to the
  [Chromium project](https://www.chromium.org/Home); Hoo inherits Electron's
  Chromium and fixes arrive with Electron updates.
- Missing features listed honestly in the README "Known problems" section
  (for example: permission prompt UX, crash recovery). These are known gaps,
  not vulnerabilities — but if you find an *unexpected* way to exploit one of
  those gaps, that is in scope.
- Social engineering of end users ("convince the user to run malware").

## Security posture (honest version)

Hoo is an Electron browser shell. It inherits Chromium's renderer sandbox but
does **not** currently provide site isolation between arbitrary sites beyond
what Electron gives by default. Treat Hoo as useful for:

- isolated web-app profiles (persistent partitions per app)
- tracker/ad host blocking with conservative allowlists
- third-party cookie/referer stripping outside compatibility hosts
- visible, local-only profile data (JSON on disk, `safeStorage` for secrets)

Treat Hoo as **not** yet suitable for:

- hostile sites that actively target browser 0days
- a guarantee that all trackers are blocked (lists are best-effort)
- anonymous browsing (Hoo is not Tor)

## Hardening rules for contributors

- Never add telemetry, analytics, or network calls that are not documented in
  the README.
- Every IPC handler must validate its arguments on the main-process side.
- Renderer code must never get direct `remote`/Node access; all privileged
  work goes through the preload bridge.
- Prefer failing closed: if a check cannot decide, do not perform the
  privileged action.
