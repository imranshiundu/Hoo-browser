# Hoo Product System

Zen is now Hoo Browser.

The name comes from the sound owls make. That gives the browser a living product identity instead of a generic technical name.

## Product idea

Hoo should feel like a browser with a companion, not a cold settings machine.

Duolingo works because Duo is not decoration. Duo gives the product a memory, a face, a rhythm, and a playful pressure system. Hoo should use the owl the same way, without becoming childish.

## Personality

Hoo is:

- watchful
- clear
- slightly playful
- protective
- fast to guide
- honest when something is experimental

Hoo is not:

- fake cute
- over-animated
- childish
- noisy
- dishonest about privacy

## UX principles

### 1. The owl explains browser state

Use Hoo to communicate:

- download completed
- camera requested
- microphone requested
- site blocked
- tab crashed
- session restored
- encryption unavailable
- update ready

### 2. OS-aware onboarding

Hoo should detect the operating system and explain what matters:

- Linux: AppImage/deb, desktop entry, permissions, secret service/keychain support
- Windows: installer, notifications, camera/mic permissions
- macOS: dmg, keychain, app permissions

### 3. Browser-first, mascot-supported

The owl should never cover the main job. It should support decisions, not steal attention.

### 4. Plain trust language

Use phrases like:

- Protected by OS encryption
- Local encryption unavailable
- Camera requested by this site
- Download blocked or failed
- Tab crashed. Restore?

Avoid phrases like:

- military-grade
- bank-level
- unbreakable
- anonymous forever

## Real browser foundation

Hoo needs these systems before it can become a daily-driver browser:

1. Download manager
2. Permission prompts for camera, microphone, notifications, location, and clipboard
3. Stable tab and session restore
4. Crash recovery
5. Maintained privacy filter lists
6. Live encryption status in the UI
7. AppImage and deb packaging

## UI direction

Visual direction:

- dark base
- DuckDuckGo orange as the active search accent
- soft green as safety/protection accent
- owl/nest language for recovery and guidance
- rounded cards
- friendly empty states
- short human messages

Examples:

- Hoo Home
- Nest Dashboard
- Hoo noticed this tab crashed
- Hoo saved your download
- Hoo needs a decision: allow camera?

## Implementation status in this branch

This branch starts the Hoo transition and adds foundations for:

- rebrand metadata
- Linux AppImage/deb build scripts
- OS profile helper
- storage fields for downloads, crashed tabs, permissions, and encryption status
- renderer API hooks for downloads, permissions, crashes, OS profile, and encryption status

The deeper browser subsystems still need dedicated implementation PRs.
