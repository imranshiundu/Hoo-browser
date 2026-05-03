# Hoo Native Security Architecture

Hoo must not become a messy browser made of every programming language. The correct direction is a small, disciplined stack where every language has a job.

## Decision

Hoo stays primarily:

- **TypeScript / JavaScript** for the Electron browser shell, renderer UI, IPC contracts, settings, tabs, downloads, permissions, session restore, and packaging glue.
- **Rust** for future native security modules where memory safety, speed, and cryptographic correctness matter.

Hoo should **not** add Java, C#, C, or C++ just because those languages exist.

## Why not add every language now?

Adding C, C++, C#, Java, Rust, and JavaScript together before the browser is stable creates more risk than power:

- harder builds on Linux, Windows, and macOS
- more security attack surface
- more installer problems
- more dependency management
- harder debugging
- slower development
- no guarantee of stronger encryption

A secure browser is not secure because it uses many languages. It is secure because its boundaries, permissions, storage, cryptography, updates, and recovery paths are designed correctly.

## Language roles

### TypeScript / JavaScript

Use for:

- Electron main process
- React renderer UI
- tab/session management
- settings UI
- downloads UI
- permission prompt UI
- update controls
- IPC contracts
- packaging scripts

This is where Hoo is today.

### Rust

Use later for:

- profile vault encryption
- secure export/import
- key derivation
- local database encryption helpers
- high-performance maintained filter parsing
- native file integrity checks
- future cross-platform updater helper

Rust is the preferred native language because it gives strong memory safety without needing a garbage-collected runtime.

### C / C++

Avoid unless absolutely necessary.

Use only if:

- binding to a mature OS API that has no good Rust/Node path
- integrating an audited native library
- performance-critical work cannot be done safely in Rust

C/C++ can be powerful, but memory bugs are one of the easiest ways to destroy browser security.

### Java

Do not use for Hoo's browser core.

Java is portable, but Hoo already gets cross-platform desktop support through Electron. Adding Java would create a second runtime without giving Hoo better browsing, privacy, or encryption.

### C#

Do not use for Hoo's browser core.

C# can be strong on Windows, but Hoo should not become Windows-only. Use Electron packaging for Windows first. Add native Windows integrations only after Linux is stable.

## Encryption decision

Hoo should protect local browser data in layers.

### Layer 1: OS-backed encryption

Current storage uses Electron `safeStorage` where available. This encrypts app data using the operating system's credential/keychain facilities.

This is useful, but not enough for a privacy-first browser.

### Layer 2: Profile vault

Next Hoo should add a profile vault:

- encrypted bookmarks
- encrypted history
- encrypted session restore
- encrypted web-app metadata
- encrypted backup/export files
- optional user passphrase
- clear warning when OS encryption is unavailable

Recommended future cryptography:

- Argon2id for password-based key derivation
- XChaCha20-Poly1305 or AES-256-GCM for authenticated encryption
- random per-vault salt
- random per-record nonce
- versioned vault format
- no custom homemade cipher for real data

CypherTool can be useful as an educational and testing tool, but Hoo should not depend on unreviewed custom encryption for user data. Browser user data needs boring, audited cryptography.

## Important wording

Hoo should not claim to be Tor.

Tor routes traffic through onion circuits to hide the user's network origin. Hoo does not currently do that.

Correct claim:

> Hoo is a privacy-focused browser shell with local data protection, DuckDuckGo-first search, tracker blocking, isolated web apps, and future stronger profile vault encryption.

Future optional privacy mode can include:

- stronger fingerprint consistency
- proxy/Tor/SOCKS profile support
- no-history private profiles
- kill switch
- DNS-over-HTTPS support
- per-site permissions

But until those exist, do not market Hoo as Tor-level anonymity.

## Cross-platform goal

Target order:

1. Linux AppImage and deb
2. Windows NSIS installer
3. macOS dmg/zip after signing strategy is clear

Electron Builder can support all three, but each OS needs testing.

## Near-term browser hardening order

1. Download manager
2. Permission prompt UI
3. Crash recovery
4. Maintained privacy filter lists
5. Stronger session restore
6. Verified AppImage/deb release builds
7. Windows build target
8. Rust profile vault prototype

This order matters. A browser that cannot download, restore sessions, or handle permissions is not ready for daily use, even if it has strong branding.
