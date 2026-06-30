# kronnus-app

React Native + Expo frontend for Kronnus — a distributed mobile timing system.
Companion backend: [`../kronnus-api`](../kronnus-api) (Go + Fiber).

---

## Prerequisites

| Tool                           | Purpose                                    |
| ------------------------------ | ------------------------------------------ |
| Node.js >= 18                  | JavaScript runtime                         |
| npm                            | Package manager                            |
| [Expo Go](https://expo.dev/go) | Run the app on your phone (iOS or Android) |
| Go >= 1.21                     | Required to run the backend                |
| Docker                         | Required to run the PostgreSQL database    |

> Both `kronnus-app` and `kronnus-api` must live in the **same parent folder**.

---

## Development

> ⚠️ **Expo Go is no longer supported.** `@react-native-firebase` requires a native build.
> Use an EAS development client instead:
>
> ```bash
> eas build --profile development --platform android
> ```
>
> Install the resulting `.apk` on your device or emulator, then start Metro:
>
> ```bash
> npx expo start --dev-client
> ```

---

## Running locally

### 1. Start the backend

```bash
# from ../kronnus-api
cp .env.example .env   # first time only
make db-up             # start PostgreSQL + run migrations
make run
```

The API will be available at `http://localhost:8080`.

### 2. Start the mobile app

```bash
# from this directory (kronnus-app)
npm install            # first time only
cp .env.example .env.local   # first time only — set EXPO_PUBLIC_API_URL
make start
```

A QR code will appear in the terminal. Scan it with **Expo Go** on your phone.

> **Physical device:** your phone and computer must be on the same Wi-Fi network.
> Set `EXPO_PUBLIC_API_URL=http://<your-machine-lan-ip>:8080` in `.env.local`.

---

## Shortcut: start everything at once

From `../kronnus-api`, after the database is already up:

```bash
make dev
```

This starts both the API and the Expo dev server in parallel. Press `Ctrl-C` to stop both.

---

## Common Makefile targets

| Command        | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `make start`   | Start Expo dev server (LAN)                                     |
| `make tunnel`  | Start with tunnel — useful when phone is on a different network |
| `make android` | Open on Android emulator                                        |
| `make ios`     | Open on iOS simulator                                           |
| `make lint`    | Run ESLint                                                      |
| `make check`   | Run lint + TypeScript type check                                |
| `make reset`   | Wipe `node_modules` and reinstall                               |
