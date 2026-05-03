# Real Browser Implementation Plan

Hoo should become real in layers. Each layer must be testable and honest.

## Layer 1: Browser runtime status

Status started in this branch.

- OS profile helper
- encryption status helper
- storage fields for downloads, permissions, crashed tabs
- preload APIs for renderer access

## Layer 2: Download manager

Required behavior:

- capture Electron download events
- save filename, URL, state, bytes received, total bytes, start time, end time
- send progress updates to the renderer
- show download shelf or download panel
- allow cancel, retry, show in folder
- warn for risky file extensions

## Layer 3: Permissions

Required permission types:

- camera
- microphone
- notifications
- location
- clipboard

Required behavior:

- never silently grant broad permissions
- show Hoo permission prompt
- allow once, always allow, deny
- store permission decision per origin
- WhatsApp media can have an app-profile rule but must remain visible

## Layer 4: Stable sessions

Required behavior:

- restore previous browser tabs
- restore active tab
- avoid duplicate tabs after restart
- separate app tabs from normal tabs
- handle invalid URLs safely

## Layer 5: Crash recovery

Required behavior:

- detect renderer crash or destroyed webContents
- record crashed tab URL/title/time
- show Hoo recovery state
- allow restore or close

## Layer 6: Maintained privacy filters

Required behavior:

- stop relying only on a hard-coded list
- support downloaded maintained host lists
- update lists on a schedule
- keep fallback built-in list
- show last filter update time
- show blocked request count per session

## Layer 7: Live encryption status

Required behavior:

- show OS encryption availability
- warn when plaintext fallback is active
- expose backup encryption state when implemented
- expose sync encryption state when implemented

## Layer 8: Packaging

Started in package metadata.

Required behavior:

- AppImage build
- deb build
- desktop metadata
- icon assets
- release output folder
- release notes

## Definition of daily-driver ready

Hoo is not daily-driver ready until:

- install works on a clean Linux desktop
- AppImage or deb can launch without manual npm commands
- downloads work
- permissions are visible and stored
- crashed tabs recover
- sessions restore reliably
- privacy filters use maintained lists
- encryption status is visible
- claims in the UI match implementation
