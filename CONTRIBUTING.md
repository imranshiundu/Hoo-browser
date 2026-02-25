# Contributing to Zen Browser

This project is open source. Anyone can contribute. There is no approval gate, no company hierarchy, and no CLA to sign. Fork the repository, make changes, and submit a pull request.

## Before You Start

Read the README thoroughly. It explains what the browser does, how the privacy engine works, and what areas need help. Understanding the existing architecture will save you time.

## Setting Up the Development Environment

1. Clone the repository
2. Run `npm install`
3. Run `npm run build` to confirm the project builds with zero errors
4. Run `npm start` to confirm the browser opens and functions
5. You are ready to make changes

For active development, run `npm run dev` (webpack watch mode) in one terminal and `npm start` in another.

## What Needs Work

These are real gaps, not theoretical improvements:

- Moving RSS feed fetching from the CORS proxy to the Electron main process's native Node.js http module. This removes an external dependency and improves reliability.
- Moving bookmarks from renderer localStorage into the main StorageService so they are part of the encrypted user-data.json.
- Building a history view. History is already being stored. There is no UI for it.
- Implementing download management. The Electron download API is not currently used.
- Adding ESLint and a formatting configuration. There is none.
- Adding unit tests for storage.ts, privacy-filters.ts, and the IPC handlers.
- OpenClaw streaming responses using Server-Sent Events instead of awaiting a full response.
- A proper application icon to replace the default Electron icon.

## Code Standards

- Use TypeScript throughout. The project is 100% TypeScript.
- Avoid the `any` type unless you can genuinely not do better.
- React functional components only. No class components.
- IPC calls between renderer and main must go through the contextBridge in preload.ts. Never use `nodeIntegration`.
- If you add a new IPC handler in main.ts, add the corresponding type in electron.d.ts and the invoke call in preload.ts.

## Submitting a Pull Request

There is no strict format required. A clear title and a one or two sentence description of what changed and why is sufficient. If it is a significant change, describe the approach you took.

## Questions

Open an issue on GitHub. There are no stupid questions. If something in the code is confusing or undocumented, that is a problem with the code, not with you.
