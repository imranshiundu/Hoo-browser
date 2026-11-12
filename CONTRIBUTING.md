# Contributing to Hoo Browser

This project is open source. Anyone can contribute. There is no approval gate, no company hierarchy, and no CLA to sign. Fork the repository, make changes, and submit a pull request.

## Before You Start

Read the README thoroughly. It explains what the browser does, how the privacy engine works, and what areas need help. Understanding the existing architecture will save you time.

## Setting Up the Development Environment

1. Clone the repository
2. Run `npm install`
3. Run `npm test` to confirm the unit suite passes
4. Run `npm run typecheck` to confirm the project typechecks cleanly
5. Run `npm run build` to confirm the project builds with zero errors
6. Run `npm start` to confirm the browser opens and functions

For active development, run `npm run dev` (webpack watch mode) in one terminal and `npm start` in another.

## What Needs Work

These are real gaps, not theoretical improvements:

- Maintained filter lists for the ad/tracker blocker (currently a curated static list in `src/main/privacy-filters.ts`).
- Permission prompt UX for camera, microphone, notifications, location, and clipboard.
- Crash recovery restore UX — crash records already exist in storage, the restore flow does not.
- Moving RSS feed fetching from the renderer into the Electron main process.
- Renderer component tests (main-process logic is covered by Vitest today).
- Adding ESLint and a formatting configuration. There is none.
- OpenClaw streaming responses using Server-Sent Events instead of awaiting a full response.
- Clean-machine verification for AppImage/deb builds.

## Code Standards

- Use TypeScript throughout. The project is 100% TypeScript.
- Avoid the `any` type unless you can genuinely not do better.
- React functional components only. No class components.
- IPC calls between renderer and main must go through the contextBridge in preload.ts. Never use `nodeIntegration`.
- If you add a new IPC handler in main.ts, add the corresponding type in electron.d.ts and the invoke call in preload.ts.
- If you change logic in `src/main`, add or update unit tests in `src/main/__tests__/`.

## Submitting a Pull Request

There is no strict format required. A clear title and a one or two sentence description of what changed and why is sufficient. If it is a significant change, describe the approach you took. CI runs typecheck, tests, and a production build on every pull request.

## Questions

Open an issue on GitHub. There are no stupid questions. If something in the code is confusing or undocumented, that is a problem with the code, not with you.
