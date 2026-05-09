# Kronnus App — Claude Context

## Project Overview

Kronnus is a distributed mobile timing system that calculates precise elapsed time between
physical checkpoints. Each smartphone acts as a Start, End, or Intermediate node. This repo
is the React Native + Expo frontend. The companion backend lives in `../kronnus-api` (Go + Fiber).

## Sibling Repository

- `../kronnus-api` — Go backend (Fiber + Gorilla WebSocket + PostgreSQL)
- Both repos share the same WebSocket protocol and session/device model
- When modifying shared contracts (WebSocket message types, session structure, device roles),
  always consider the impact on `../kronnus-api`

## Tech Stack

- Framework: React Native + Expo (TypeScript)
- Real-time: WebSockets (coordinates device sessions with the backend)
- UI Mockups: Affinity Designer (designs exist before implementation)
- CI/CD: GitHub Actions + Husky + lint-staged
- Linting/Formatting: ESLint + Prettier (enforced on commit via lint-staged)

## Architecture

- Each device is assigned a role: `Start`, `End`, or `Intermediate`
- Checkpoint triggers supported: digital button press, camera sensor detection
  (Bluetooth laser trigger is a stretch goal if time allows)
- Time sync: device sends ping to server, calculates round-trip offset (NTP-like)
- NTP offset is applied **server-side** — the app sends raw `Date.now()` timestamps;
  `service.go` adds `clock_offset_ms` from the checkpoints table to produce `corrected_at`
- Precision target: ~10–20ms accuracy (to be measured and documented honestly for academic purposes)

## API Layer Conventions

- `API_BASE_URL` is exported **once** from `src/api/client.ts` — never redefine it locally
- All session CRUD lives in `src/api/client.ts`; all timestamp CRUD in `src/api/timestamps.ts`
- WebSocket message types live in `src/ws/messages.ts` and must mirror `internal/ws/message.go`
- Design tokens live in `constants/theme.ts` as `AppColors` — do not redefine inline per screen

## Project Structure Conventions

- Barrel exports per folder — always use `index.ts` re-exports, never import directly from deep paths
- Components are colocated with their styles and types when small enough
- Shared types (especially WebSocket message shapes) live in a dedicated `types/` folder
- Tests live in `__tests__/` (root) — not co-located with source files
- Keep `.env.example` up to date when adding new environment variables

## Code Conventions

- TypeScript strict mode — no `any`, no implicit types
- ESLint + Prettier enforced — run before assuming something works: `npx expo lint`
- Functional components only, hooks for all stateful logic
- Prefer explicit prop types (interfaces) over inlined types for reusable components
- Avoid business logic in components — keep them presentational where possible
- WebSocket message types must match what `../kronnus-api` expects exactly

## Branching Strategy

- `main` — protected, production-ready
- `develop` — integration branch
- `feature/[issue-number]-short-description` — feature branches

## GitHub Project Management

- Project board: "Kronnus - Just in Time"
- Issue hierarchy: EPIC → TASK
- Milestones: Architecture & Setup → Time Sync Core → Mobile App → Backend → Integration & Testing → Documentation & Thesis

## Academic Context

This is a Bachelor's Final Project at UOC (Universitat Oberta de Catalunya).

- The supervisor will review GitHub history — keep commits clean and meaningful
- Timing precision limitations must be documented honestly, not glossed over
- The project must demonstrate: cross-platform mobile development, sensor integration, real-time networking
- All documentation and code comments must be written in English

## Key Domain Concepts

- **Session**: a timing run involving multiple devices
- **Device**: a smartphone assigned a role (Start / End / Intermediate)
- **Checkpoint**: a triggered timestamp event — button press or camera detection
- **Offset**: the calculated clock difference between this device and the server
- **Elapsed time**: duration between checkpoints, corrected by offsets

## When Debugging

- Check WebSocket connection state first — is the device connected and has it completed time sync?
- Camera trigger issues: check Expo Camera permissions and frame processing performance
- Button trigger issues: verify that `Date.now()` is captured at the moment of press, not after any async gap
- Type errors between app and API: cross-reference WebSocket message types with `../kronnus-api`
- Run `npx expo lint` before diving deep — type mismatches cause subtle runtime bugs

## When Writing New Features

- Check if a UI mockup exists in Affinity Designer before implementing
- Start from the WebSocket message contract if the feature involves real-time communication
- Add barrel export to the relevant `index.ts` after creating a new component or utility
- Keep `.env.example` updated if new config is introduced
- Consider whether `../kronnus-api` needs a corresponding change
