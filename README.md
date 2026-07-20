<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="assets/brand/locked-and-lean-brand-dark.png"
    />
    <img
      alt="Locked and Lean logo"
      src="assets/brand/locked-and-lean-brand-light.png"
      width="150"
    />
  </picture>
</p>

<h1 align="center">Locked and Lean</h1>

<p align="center">
  <strong>A faster, review-first calorie and macro tracker made for everyday Filipino meals.</strong>
</p>

<p align="center">
  Remember usual portions, keep logging during unreliable internet, follow calorie and protein targets, and confirm every estimate before it becomes part of your history.
</p>

<p align="center">
  <a href="https://github.com/AxeL21-cs/Locked-and-Lean/releases/download/v0.4.2/Locked-and-Lean-0.4.2-build-6.apk">
    <img alt="Download Android APK" src="https://img.shields.io/badge/Download_Android_APK-v0.4.2-8CDD08?style=for-the-badge&logo=android&logoColor=07130D" />
  </a>
  <a href="https://locked-and-lean-web.vercel.app/">
    <img alt="Open web preview" src="https://img.shields.io/badge/Open_Web_Preview-07130D?style=for-the-badge&logo=vercel&logoColor=white" />
  </a>
</p>

> **Current release:** Android 0.4.2 (build 6). This is a signed public test
> release, not a Play Store release or medical device. Nutrition estimates and
> targets should always be reviewed.

## What can you do with Locked and Lean?

- **Log food without starting over every time.** Repeat breakfast, copy
  yesterday, reuse recent foods, and remember familiar servings such as your
  usual rice portion at home.
- **Review before saving.** Every meal shows its items, portions, calories,
  macros, assumptions, and uncertainty before you confirm it.
- **Keep working with poor internet.** Today, Calendar, and saved-food data are
  cached on the device. Offline entries show their sync status and reconnect
  without creating duplicates.
- **Plan around a weight goal.** Enter your height, weight, activity, and target
  weight to receive a reviewable calorie, protein, and timeline estimate.
- **See more than a daily number.** Follow calories and macros on Today, browse
  meal history in Calendar, and review weight and nutrition trends in Progress.
- **Use light or dark mode.** The Android interface follows your system or your
  selected theme.
- **Ask through ChatGPT.** The developer-preview ChatGPT plugin can answer
  questions about today's calories and weekly protein, and can prepare a meal
  preview that still requires your confirmation.

## How food logging works

Locked and Lean follows one rule:

> **Interpret first, verify second, log third.**

1. Describe the meal, scan a supported barcode, choose a saved food, or start
   from a previous meal.
2. Check the complete preview, including portions, totals, assumptions, and
   uncertainty.
3. Correct anything that looks wrong.
4. Confirm that exact version. Nothing becomes permanent before confirmation.

This matters because a photo or description cannot reveal an exact weight,
hidden oil, recipe, or restaurant formulation.

## Download and install the Android app

### 1. Download the APK

**[Download Locked and Lean 0.4.2 for Android](https://github.com/AxeL21-cs/Locked-and-Lean/releases/download/v0.4.2/Locked-and-Lean-0.4.2-build-6.apk)**

The link above downloads the APK directly from this repository's
[GitHub Release](https://github.com/AxeL21-cs/Locked-and-Lean/releases/tag/v0.4.2).

- File: `Locked-and-Lean-0.4.2-build-6.apk`
- Size: 133,333,189 bytes
- SHA-256:
  `6C2D505E2A74B0F61D9C31FD07ED7EC54B96A3A0D3C2BD2E0CD2A654826E3007`
- Requires Android 7.0 or newer

### 2. Install it

1. Open the downloaded APK from your browser or **Downloads** folder.
2. If Android asks, allow that browser or file manager to **Install unknown
   apps**.
3. Tap **Install**.
4. Open **Locked and Lean**, create an account or sign in, and complete the
   profile and target setup.

To update an existing installation, download the newer APK and install it over
the current app. Do not uninstall first if you want to preserve its local app
data.

Only install APKs from the release link in this repository. The APK is signed,
archive-validated, and physically tested as an update on Android.

## Using the app

| Tab          | What it is for                                                     |
| ------------ | ------------------------------------------------------------------ |
| **Today**    | See calories, macros, remaining targets, sync status, and meals.   |
| **Calendar** | Browse previous days and open confirmed meals.                     |
| **Add**      | Log manually, scan a barcode, or reuse a saved or previous meal.   |
| **Progress** | Follow calorie, protein, macro, and body-weight trends.            |
| **Profile**  | Review your goal, update weight and targets, or change appearance. |

## Install the Locked and Lean ChatGPT plugin

> **Developer preview:** Locked and Lean has not yet been published in the
> public ChatGPT plugin catalog. The hosted server is available for approved
> testing, but protected personal-data tools only work for OAuth client
> registrations explicitly approved by the project owner.

If Locked and Lean is already connected to your ChatGPT account, keep that
connection. Deleting and recreating it produces a new client registration that
must be approved again.

### Connect an approved testing account

1. Open [ChatGPT](https://chatgpt.com/) on the web.
2. Open **Settings → Security and login** and turn on **Developer mode**.
3. Open **Settings → Plugins**, or visit
   [chatgpt.com/plugins](https://chatgpt.com/plugins).
4. Select the **+** button to create a developer-mode app.
5. Enter:
   - **Name:** `Locked and Lean`
   - **Description:** `Review Locked and Lean calorie history, protein trends, and food-log previews.`
   - **MCP server URL:**
     `https://locked-and-lean-mcp.vercel.app/mcp`
6. Select **Create** and confirm that ChatGPT displays the available tools.
7. Keep this app instance. If its protected tools are not yet approved, the
   project owner must approve its OAuth client registration before reconnecting
   will help.
8. Open a new chat, select **+ → More → Locked and Lean**, and try:
   - “How many calories have I eaten today?”
   - “Show my weekly protein average.”
   - “Prepare a lunch preview for chicken adobo and rice. Do not save it until
     I confirm.”
9. When prompted, sign in with the same Locked and Lean account used by the
   mobile app and review the connection.

After the app is linked on ChatGPT web, it is also available in supported
ChatGPT mobile apps. See OpenAI's
[Connect from ChatGPT](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)
guide for the current developer-mode interface.

The currently approved connector can read calendar-based calorie and protein
information and can create, revise, and exactly confirm food previews. Other
clients and broader update, delete, copy, or weight actions remain blocked by
default. A policy denial requires owner approval; repeatedly reconnecting does
not grant more access.

For the complete operator and security notes, see
[ChatGPT app setup](docs/CHATGPT_APP_SETUP.md).

## Run the project locally

This section is for developers who want to run the source code instead of
installing the APK.

### Requirements

- Node.js 20.19 or newer and npm
- Docker Desktop for the local Supabase backend
- An Android device/emulator or a web browser
- macOS and Xcode only if you want to use the iOS Simulator

### 1. Clone and install

```powershell
git clone https://github.com/AxeL21-cs/Locked-and-Lean.git
cd Locked-and-Lean
npm ci
```

### 2. Create the local environment

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Start Supabase, then retrieve its local public URL and key:

```powershell
npx supabase@2.109.1 start
npx supabase@2.109.1 status -o env
```

Add the local URL and public key to `.env`:

```dotenv
EXPO_PUBLIC_PRODUCT_NAME=Locked and Lean
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54821
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local public key>
```

Never place a service-role key or another secret in an `EXPO_PUBLIC_*`
variable.

### 3. Apply the database and start Expo

```powershell
npm run db:reset
npm start
```

From Expo, open the Android or web target. You can also use:

```powershell
npm run android
npm run web
```

See [Local development](docs/LOCAL_DEVELOPMENT.md) for database tests,
environment details, MCP development, and troubleshooting.

## Privacy and safety

- The app shows uncertainty instead of presenting estimated portions as exact.
- Permanent food writes are transactional and protected against duplicate
  retries.
- Supabase Row Level Security keeps each account's data owner-scoped.
- ChatGPT performs meal interpretation externally. The mobile app, database,
  and MCP server do not contain an OpenAI API key or call OpenAI model APIs.
- The current barcode catalog contains development records, not a complete
  licensed Philippine food database.
- Automatic weight-goal targets are adult informational estimates, not medical
  advice and not intended for pregnancy, breastfeeding, eating-disorder care,
  or medical treatment.

## Built with

- Expo, React Native, TypeScript, and Expo Router
- Supabase Auth, PostgreSQL, Row Level Security, and reviewed RPCs
- Expo SQLite for offline caching and synchronization
- Model Context Protocol and the OpenAI Apps SDK for the ChatGPT integration
- Vercel for the hosted web and MCP services
- EAS Build for signed Android releases

## Built with Codex during OpenAI Build Week

Codex and GPT-5.6 were used throughout the Build Week extension of Locked and
Lean to implement and test offline synchronization, quicker repeat logging,
OAuth-protected ChatGPT preview and confirmation flows, the Android light/dark
redesign, and the goal-weight target planner.

The project intentionally keeps model calls outside the mobile app and backend.
Important product and security decisions—especially the exact
preview-before-confirmation rule, RLS ownership boundary, uncertainty language,
and fail-closed OAuth policy—remain explicit parts of the design rather than
shortcuts around it.

## Technical documentation

The main README stays user-focused. Deeper engineering evidence is available
here:

- [Current project status](docs/PROJECT_STATUS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data flow](docs/DATA_FLOW.md)
- [Security and RLS](docs/RLS_AND_SECURITY.md)
- [Testing](docs/TESTING.md)
- [AI estimation limitations](docs/AI_ESTIMATION_LIMITATIONS.md)
- [Production checklist](docs/PRODUCTION_CHECKLIST.md)
