# PostFlow — Marketing Post Manager

A tool for generating, approving, and copying marketing content for LinkedIn and WordPress using AI.

---

## Requirements

- [Node.js](https://nodejs.org/) version 18 or higher
- A web browser (Chrome, Edge, Firefox)
- A Claude API key from [console.anthropic.com](https://console.anthropic.com/)
- A Firebase account (for saving posts) — free tier is enough

---

## Step 1 — Download and install dependencies

1. Download or clone this project folder to your computer
2. Open **Command Prompt** (`cmd`) — not PowerShell
3. Navigate to the project folder:
   ```
   cd C:\path\to\MWF
   ```
4. Install dependencies:
   ```
   npm install
   ```

---

## Step 2 — Configure your API keys

Open the `.env` file in the project folder with any text editor (Notepad is fine).

Fill in your credentials:

```
# Claude AI — get your key at https://console.anthropic.com/
VITE_CLAUDE_API_KEY=sk-ant-...your key here...

# Firebase — see Step 3 below
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

> LinkedIn and WordPress fields can be left as-is — content is copied to your clipboard manually instead of publishing automatically.

---

## Step 3 — Set up Firebase (for saving posts)

Firebase stores your posts so they persist between sessions.

1. Go to [firebase.google.com](https://firebase.google.com/) and sign in with a Google account
2. Click **Go to console** → **Add project**
3. Give it a name (e.g. `my-postflow`) and click through the setup steps
4. Once the project is created, click the **Web** icon (`</>`) to add a web app
5. Give it a nickname, then click **Register app**
6. You will see a code block with `firebaseConfig` — copy each value into your `.env` file:

   | Firebase field | .env variable |
   |---|---|
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId` | `VITE_FIREBASE_APP_ID` |
   | `measurementId` | `VITE_FIREBASE_MEASUREMENT_ID` |

7. In the Firebase console left menu, click **Build → Firestore Database**
8. Click **Create database** → choose **Start in test mode** → pick a region close to you → click **Enable**

---

## Step 4 — Start the app

In Command Prompt, from the project folder:

```
npm run dev
```

You should see:

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## How to use the app

### Creating a post

1. Click **Create Post** in the top navigation
2. Choose a channel: **LinkedIn** or **WordPress**
3. For WordPress, enter a post title
4. Type a prompt describing what you want — for example:
   - *"Write a post about the benefits of morning routines for productivity"*
   - *"Announce our new product launch targeting small business owners"*
5. Click **Generate with AI** and wait a few seconds
6. Review and edit the generated content in the text box below
7. Click **Submit for Approval** to save the post

### Approving a post

1. From the Dashboard, find your post (it will show status: **Pending**)
2. Click the post to open it, or use the **✓ Approve** button on the card
3. Once approved, the status changes to **Approved**

### Copying and publishing manually

1. Open an approved post
2. Click **📋 Copy for LinkedIn** or **📋 Copy for WordPress**
3. The content is now in your clipboard
4. Go to LinkedIn or your WordPress editor and paste it

> For WordPress HTML posts: paste into the **Code editor** view, not the visual editor.

### Post statuses explained

| Status | Meaning |
|---|---|
| **Pending** | Submitted, waiting for review |
| **Approved** | Ready to copy and publish |
| **Published** | Content has been copied |
| **Rejected** | Needs revision — can be re-approved |

---

## Stopping the app

Press `Ctrl + C` in the Command Prompt window where the app is running.

To start it again later, run `npm run dev` from the project folder.

---

## Troubleshooting

**`npm` is not recognized**
→ Install Node.js from [nodejs.org](https://nodejs.org/) and reopen Command Prompt.

**npm cannot be loaded / script not digitally signed**
→ You are using PowerShell. Use **Command Prompt** (`cmd`) instead.

**Generation failed / AI not responding**
→ Check that `VITE_CLAUDE_API_KEY` in your `.env` file is filled in correctly with no extra spaces.

**Posts not saving between sessions**
→ Check that all `VITE_FIREBASE_*` values are filled in and Firestore is enabled in your Firebase project.
