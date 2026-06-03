# AI Novel Factory Desktop Shell

This directory is the desktop wrapper target for the shared AI Novel Factory frontend.

## Scope

- `src-tauri/` contains the native Tauri v2 shell.
- The web frontend is expected to live in `apps/desktop/`.
- Tauri is configured to:
  - load `http://localhost:4310` during development
  - load static assets from `apps/desktop/dist` for packaged builds

## Current Status

The desktop shell is scaffolded, but it is **not runnable on this machine yet**.

Reason:

- `rustc` is not installed
- `cargo` is not installed
- the Tauri CLI/toolchain is not installed

That means this repo now has the native wrapper structure in place, but local desktop commands such as `cargo tauri dev` or `cargo tauri build` will fail until the Rust/Tauri toolchain is installed.

## Minimal Scaffold

The current scaffold intentionally stays small:

- `src-tauri/Cargo.toml`
  - declares a Tauri v2 app crate
- `src-tauri/tauri.conf.json`
  - points to a shared frontend in `apps/desktop`
  - uses `../dist` as the packaged asset directory
  - uses `http://localhost:1420` as the dev server URL
- `src-tauri/src/main.rs`
  - starts a plain Tauri application with no custom commands yet

## Expected Frontend Contract

The native shell assumes a frontend workflow like this:

1. A dev server runs from `apps/desktop` on port `4310`
2. A production build outputs static files into `apps/desktop/dist`
3. The frontend talks to the existing AI Novel Factory backend/orchestration layer

This keeps desktop and web aligned around the same frontend surface instead of maintaining a separate UI implementation for native.

## Next Steps

Once the machine has the Rust/Tauri toolchain installed, the next practical steps are:

1. Add the actual frontend app under `apps/desktop`
2. Add desktop-level scripts for dev/build
3. Start the desktop shell against the shared frontend
4. Add Tauri commands only if the web client needs native capabilities beyond the local HTTP/API flow

## Toolchain Setup Reminder

Before trying to run the desktop shell, install:

- Rust (`rustup`, `rustc`, `cargo`)
- Tauri CLI for v2
- platform prerequisites required by Tauri on macOS

Until then, this directory should be treated as a ready scaffold, not a runnable desktop app.
