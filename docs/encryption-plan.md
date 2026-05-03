# Encryption Plan

Zen needs encryption because browsers store sensitive data: tabs, history, bookmarks, settings, sync metadata, app profile state, and eventually downloads or exports.

Encryption must be real and explainable. It should protect user data without pretending to make the browser anonymous.

## Current state

The current storage layer uses Electron `safeStorage` when available. That is a good start because it lets the operating system protect encrypted data through the user's local keychain or secret service.

Problem: if OS encryption is unavailable, the app can fall back to plaintext. That fallback must be visible to the user.

## Encryption levels

### Level 1: Local profile encryption

Purpose: protect local Zen profile data at rest.

Data covered:

- settings
- tabs
- history
- bookmarks once moved from renderer storage
- sync metadata
- app profile metadata

Implementation direction:

- keep using Electron `safeStorage` where available
- expose encryption status in Privacy or Settings
- warn clearly when encryption is unavailable
- avoid storing secrets in plain JSON

### Level 2: Backup export encryption

Purpose: let the user export a backup safely.

Data covered:

- bookmarks
- settings
- tabs
- selected history if user chooses

Implementation direction:

- export encrypted `.zenbackup` file
- use a user passphrase
- use modern authenticated encryption
- include version metadata for future imports

Recommended primitive:

- Argon2id or scrypt for passphrase key derivation
- XChaCha20-Poly1305 or AES-256-GCM for encryption

Node support and package choice should be reviewed before implementation.

### Level 3: Sync encryption

Purpose: protect synced data before it leaves the machine.

Data covered by default:

- tabs
- settings
- bookmarks

Data not synced by default:

- cookies
- passwords
- session tokens
- app login sessions

Implementation direction:

- encrypt sync payload before upload
- store only encrypted blobs remotely
- show last sync time
- provide manual export/import fallback
- handle conflicts instead of overwriting blindly

### Level 4: Per-app profile protection

Purpose: avoid mixing WhatsApp, GitHub, ChatGPT, Proton, and normal browsing state.

Implementation direction:

- each app gets a named isolated partition
- each app shows stored data controls
- user can clear one app without wiping the full browser
- permissions are visible per app

## User-facing encryption status

Zen should show one of these states:

```text
Protected by OS encryption
Local encryption unavailable: profile data may be stored as plaintext
Backup encryption enabled
Sync encryption enabled
Sync encryption disabled
```

## Important rule

Do not call anything bank-level, military-grade, prison-level, or unbreakable. That language makes the project look unserious.

Use precise language:

- encrypted at rest
- encrypted before sync
- protected by OS keychain
- passphrase-protected export
- not synced by default

## First implementation tasks

1. Add storage encryption status to the settings screen.
2. Move bookmarks from renderer localStorage into main-process storage.
3. Add manual encrypted export/import.
4. Encrypt sync payload before upload.
5. Add conflict handling for sync.
6. Add tests for storage load/save, encrypted fallback, and corrupted file recovery.
