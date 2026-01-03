# Fasting Lane - Project Context

## Product summary
- Intermittent fasting tracker with eating window logging and calorie notes.
- Offline-first, local-only storage (no login or sync yet).
- Calm minimal UI using Manrope font.

## Core features (current)
- Start/stop fasting, adjust times, one active fast at a time.
- Current window shows fasting or eating with ring progress and time left.
- Reminders: fasting start/end, hydration (fasting/eating/both), calorie goal near, test reminder.
- Eating window notes with calories, manual edit + delete, and photo scan.
- Eating window history with thumbnails, notes, calorie totals, retention limit, clear-all.
- Insights: weekly fasting chart, daily calories chart, session history toggle.
- Smart tools:
  - If I eat this (text estimate)
  - Portion coach
  - Fridge ideas (photo-based meal ideas)
  - Goal tuning (recommended protocol from logs)
  - Eating window autopilot (meal plan ideas)
  - Craving rescue (panic button on Home)
- Adaptive plan: goal-based ramp with weekly check-ins and adjustments.

## Data and storage
- Local SQLite via `expo-sqlite` for sessions, notes, settings.
- Photos stored locally as thumbnails; server does not persist images.

## Tech stack
- Expo SDK 54, React Native 0.81, React 19, TypeScript.
- React Navigation bottom tabs.
- Expo modules: notifications, image picker, file system, linear gradient, sqlite.
- Server: Node + Express + multer + sharp.

## Environments and config
App env vars:
- `EXPO_PUBLIC_FOOD_API_URL`
- `EXPO_PUBLIC_FOOD_API_KEY`

Server env vars:
- `OPENAI_API_KEY`
- `USDAFOOD_KEY`
- `USDAFOOD_USER` (optional)
- `APP_API_KEY` (optional, X-API-KEY auth)

## Build and run
- App: `npm install` then `npm run start`.
- EAS builds: `eas build --profile development|production --platform ios`.
- Server: `npm install` then `npm start` in `server/`.

## App Store info
- Bundle ID: `com.dirkwybe.fastlane`
- Category: Health & Fitness
- Paid app (current plan)

## Notes and current focus
- Notifications require a dev client; Expo Go has limitations for `expo-notifications`.
- Current UI polish focus: ensure section header icons align across all cards.
