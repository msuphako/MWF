# How We Built PostFlow — A Complete Guide

**For anyone who wants to understand this project from the very beginning.**

---

## What is this app?

PostFlow is a website that helps you write marketing posts for LinkedIn and WordPress.

You type a topic, click a button, and an AI writes the post for you. Then you can edit it, approve it, copy it, and paste it into LinkedIn or WordPress yourself.

That's it. Simple idea, but we needed to build a lot of pieces to make it work.

---

## What you need before starting

You need three things installed on your computer:

### 1. Node.js
Node.js lets your computer run JavaScript outside of a browser. Think of it like an engine that powers your project.

- Download it from: **nodejs.org**
- Pick the version that says **LTS** (that means "stable and reliable")
- Install it like a normal program

To check it worked, open **Command Prompt** (search for `cmd` in the Start menu) and type:
```
node --version
```
If you see a number like `v22.0.0`, you're good.

### 2. A code editor
This is where you write and read code. We recommend **Visual Studio Code** (it's free).
- Download from: **code.visualstudio.com**

### 3. A Google account
You need one to set up Firebase (the database). You probably already have one.

---

## Understanding the project files

Before we explain how to build everything, let's understand what each file in the project does.

```
MWF/
├── marketing-post-manager.jsx   ← The entire app. All buttons, screens, and logic live here.
├── main.jsx                     ← Starts the app (like pressing the power button)
├── index.html                   ← The blank webpage the app loads into
├── index.css                    ← Tells the app to use Tailwind CSS for styling
├── package.json                 ← The shopping list of tools the project needs
├── vite.config.js               ← Settings for the tool that runs and builds the app
├── tailwind.config.js           ← Settings for the styling tool
├── postcss.config.js            ← Helps Tailwind CSS work with Vite
├── .env                         ← Your secret keys (never share this file)
├── .env.example                 ← A blank template showing which keys are needed
├── .gitignore                   ← Tells Git which files to ignore (like .env)
├── start.bat                    ← A double-click shortcut to start the app
├── SETUP.md                     ← Short setup instructions
└── GUIDE.md                     ← This file
```

---

## Part 1 — The starting point

We started with just **one file**: `marketing-post-manager.jsx`.

This file already had the full app written in it — buttons, screens, logic for talking to AI and Firebase. But it had two problems:

**Problem 1:** It loaded Firebase from the internet using a long URL:
```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
```
This works in a browser, but not in a proper development setup.

**Problem 2:** All the secret API keys were written directly in the file:
```js
const CONFIG = {
  CLAUDE_API_KEY: "YOUR_CLAUDE_API_KEY",
  ...
}
```
This is dangerous — if you share the file, you share your keys.

Our job was to fix both problems and turn this single file into a proper project.

---

## Part 2 — Setting up the project tools

### What is Vite?

Vite is a tool that:
- Lets you run your app locally at `http://localhost:5173`
- Automatically refreshes the browser when you save a file
- Builds your app into a finished website when you're ready to publish

### What is React?

React is the library that makes the app's buttons and screens work. The `.jsx` file extension means the file uses React.

### What is Tailwind CSS?

Tailwind is a styling tool. Instead of writing a separate CSS file, you add short words like `text-blue-600` or `rounded-xl` directly onto elements, and it figures out the styling.

### Step 1 — Create `package.json`

This file lists all the tools the project needs. Think of it like a shopping list.

```json
{
  "name": "marketing-post-manager",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.12.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.15",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "vite": "^5.4.10"
  }
}
```

- `dependencies` = tools needed when the app is running
- `devDependencies` = tools only needed while you're building it
- `scripts` = shortcuts. `npm run dev` runs the `"dev": "vite"` line.

### Step 2 — Create `vite.config.js`

This tells Vite to use the React plugin so it understands `.jsx` files.

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
```

### Step 3 — Create `tailwind.config.js`

This tells Tailwind which files to look at to find the styling words.

```js
export default {
  content: ["./index.html", "./*.jsx"],
  theme: { extend: {} },
  plugins: [require("@tailwindcss/typography")],
};
```

The `@tailwindcss/typography` plugin makes HTML blog posts look nice with proper font sizes and spacing.

### Step 4 — Create `postcss.config.js`

PostCSS is a helper that processes CSS. Tailwind needs it to work.

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

### Step 5 — Create `index.html`

This is the blank webpage that the app loads into. Vite fills in the rest automatically.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PostFlow — Marketing Post Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>
```

The `<div id="root">` is an empty box. React fills this box with all the buttons and screens.

### Step 6 — Create `index.css`

Three lines that activate Tailwind CSS:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 7 — Create `main.jsx`

This is the power button. It finds the empty `#root` box in `index.html` and puts the app inside it.

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./marketing-post-manager.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### Step 8 — Install everything

Open Command Prompt in the project folder and run:

```
npm install
```

This reads `package.json` and downloads all the tools into a `node_modules` folder. This takes about a minute.

---

## Part 3 — Moving secret keys to `.env`

### Why does this matter?

If you put your API key directly in `marketing-post-manager.jsx` and share the file with someone, they get your key. They can use it to generate AI content and charge it to your account.

A `.env` file keeps secrets separate. The `.gitignore` file makes sure Git never saves it. So if you upload your code to GitHub, your keys stay safe.

### How it works

Vite reads the `.env` file and makes the values available in your code using `import.meta.env.VITE_...`

**Before (dangerous):**
```js
const CONFIG = {
  CLAUDE_API_KEY: "sk-ant-api03-...",
};
```

**After (safe):**
```js
const CONFIG = {
  CLAUDE_API_KEY: import.meta.env.VITE_CLAUDE_API_KEY,
};
```

The `.env` file (which is **never shared**) contains:
```
VITE_CLAUDE_API_KEY=sk-ant-api03-...
```

**Important rule:** Every variable in `.env` that you want to use in your app must start with `VITE_`. Variables without that prefix stay hidden.

### The `.env.example` file

This is a blank copy of `.env` with no real values. You commit this to Git so other people know which variables they need to fill in.

---

## Part 4 — Fixing the Firebase imports

### Before

The original file loaded Firebase from a Google CDN (content delivery network — basically, the internet):

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
```

### After

Since we now have `node_modules`, we use the proper npm package:

```js
import { initializeApp } from "firebase/app";
```

This is shorter, faster, and works with the Vite build system.

---

## Part 5 — What is Firebase?

Firebase is a service made by Google. It gives you a database without having to build one yourself.

We use two parts:

### Firestore (the database)
Firestore stores your posts. Every time you create a post, it saves to Firestore. Every time you open the app, it loads your posts from Firestore.

Think of Firestore like a shared Google Sheet that your app can read and write to.

### Firebase Storage (for images)
Firebase Storage stores image files. When you upload an image in the editor, it goes to Firebase Storage. The app gets back a URL (a web address) for that image and puts it in your post.

### How to set up Firebase

1. Go to **firebase.google.com** and sign in
2. Click **Add project** — give it a name
3. Click the **Web** icon (`</>`) — give it a nickname — click **Register app**
4. Copy the `firebaseConfig` values into your `.env` file
5. In the left menu: **Build → Firestore Database → Create database** → Test mode → Enable
6. In the left menu: **Build → Storage → Get started** → Test mode → Enable

---

## Part 6 — Fixing the AI API (CORS problem)

### What is CORS?

CORS stands for Cross-Origin Resource Sharing. It's a security rule built into browsers.

When your app (running at `localhost:5173`) tries to talk to the Anthropic API (at `api.anthropic.com`), the browser says: "Wait — you're from a different address. I won't allow this."

This is a browser security feature to stop hackers. But it also stops our app.

### The solution: a proxy

A proxy is a middleman. Instead of the browser talking directly to Anthropic:

```
Browser → Anthropic API  ✗ (blocked)
```

We tell the browser to talk to Vite's own server, which then forwards the request to Anthropic:

```
Browser → Vite proxy → Anthropic API  ✓ (allowed)
```

Because Vite's proxy is server-side (not in the browser), CORS doesn't apply.

### How we set it up

In `vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/anthropic": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
      "/api/openai": {
        target: "https://api.openai.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
    },
  },
});
```

In the app code, we changed the API URL from:
```js
fetch("https://api.anthropic.com/v1/messages", ...)
```
to:
```js
fetch("/api/anthropic/v1/messages", ...)
```

We also remove the `origin` and `referer` headers so Anthropic doesn't detect the browser origin and block it.

---

## Part 7 — The AI generation system

### Two providers

The app can use two different AI services:

| Provider | Company | What model |
|---|---|---|
| Claude | Anthropic | claude-sonnet-4-6 (or whichever you set) |
| GPT-4o | OpenAI | gpt-4o |

Both work the same way: you send them a message, they send back text.

### How the code works

```js
async function generateWithClaude(prompt, channel, tone) {
  // 1. Build the system prompt (tells the AI what kind of writer to be)
  // 2. Add tone instructions (professional / casual / inspirational / bold)
  // 3. Send a request to the API
  // 4. Return the text the AI wrote
}
```

### What is a "system prompt"?

A system prompt is instructions you give to the AI *before* the user's message. It sets the personality.

For LinkedIn:
> *"You are an expert LinkedIn content creator. Write engaging, professional posts..."*

For WordPress:
> *"You are an expert blog writer. Write a full, well-structured blog post in HTML..."*

### What is "tone"?

The tone changes how the writing sounds. We have four options:

- **Professional** — formal and authoritative
- **Casual** — friendly and relaxed
- **Inspirational** — motivating and uplifting
- **Bold** — short, punchy, direct

The tone instruction gets added to the system prompt before sending it to the AI.

---

## Part 8 — The "publish" decision

Originally the app had real LinkedIn and WordPress publishing — it would automatically post for you.

We decided to turn this off and use **clipboard copy** instead.

**Why?** Setting up LinkedIn and WordPress API connections requires a lot of steps and credentials. For now, it's simpler to:
1. Click "📋 Copy for LinkedIn"
2. Open LinkedIn in your browser
3. Paste and post manually

This works fine for everyday use. The API publishing can be re-added later.

---

## Part 9 — How posts flow through the app

Every post goes through these steps:

```
[Create] → pending → approved → published (copied)
                  ↓
               rejected → (re-approve) → approved
```

| Status | What it means |
|---|---|
| **Pending** | You submitted the post for review |
| **Approved** | Reviewed and ready to copy/publish |
| **Published** | Content has been copied to clipboard |
| **Rejected** | Needs revision |

---

## Part 10 — Features we added to the editor

### Image insertion (in Post Detail edit mode)

When editing a post, you can insert images two ways:
1. **Upload from device** — the image goes to Firebase Storage, and the URL gets inserted into your post
2. **Paste a URL** — just type an address like `https://example.com/photo.jpg`

For WordPress posts, images are wrapped in an `<img>` tag. For LinkedIn, just the URL is inserted.

### Tone selector (in Create Post)

Before generating, pick a tone. This changes the instruction sent to the AI.

### Generate 3 Variations

Instead of generating one post, the app sends 3 requests at the same time (in parallel) and shows you all 3. You pick the one you like.

### ↻ Regenerate

After seeing the first result, clicking the button again generates a new version using the same prompt and settings.

### Character counter

- **LinkedIn**: shows `X / 3000`. Goes yellow when you're close to the limit, red when you go over.
- **WordPress**: shows word count instead.

### ↺ Revert to generated

If you edited the content and want to go back to what the AI originally wrote, click this button.

### 👁 Preview / ✎ Code (in Post Detail)

For WordPress posts, you can toggle between:
- **Code view** — see the raw HTML
- **Preview** — see how it will look when published

### 🔍 Find & Replace

Search for a word in your post and replace it with something else. Useful for changing brand names, URLs, or fixing repeated typos.

---

## Part 11 — The `start.bat` shortcut

Normal users shouldn't have to open Command Prompt every time. So we made a `.bat` file.

```bat
@echo off
cd /d "%~dp0"
echo Starting PostFlow...
start "" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
```

What this does, line by line:
1. `@echo off` — stops the script from printing every command it runs
2. `cd /d "%~dp0"` — navigates to the folder where the `.bat` file lives
3. `echo Starting PostFlow...` — prints a message so you know something is happening
4. Opens a new Command Prompt window and runs `npm run dev`
5. Waits 3 seconds for the server to start
6. Opens `http://localhost:5173` in your browser automatically

Double-clicking `start.bat` is all a normal user needs to do.

---

## Running the app

### First time only
```
npm install
```

### Every time after
Double-click `start.bat` — or in Command Prompt:
```
npm run dev
```

Then open: **http://localhost:5173**

### To stop
Close the Command Prompt window that has `npm run dev` running in it.

---

## Filling in your `.env` file

Open `.env` in any text editor and fill in your values:

```
VITE_FIREBASE_API_KEY=         ← from Firebase Console → Project Settings
VITE_FIREBASE_AUTH_DOMAIN=     ← from Firebase Console
VITE_FIREBASE_PROJECT_ID=      ← from Firebase Console
VITE_FIREBASE_STORAGE_BUCKET=  ← from Firebase Console
VITE_FIREBASE_MESSAGING_SENDER_ID= ← from Firebase Console
VITE_FIREBASE_APP_ID=          ← from Firebase Console
VITE_FIREBASE_MEASUREMENT_ID=  ← from Firebase Console

VITE_CLAUDE_API_KEY=           ← from console.anthropic.com
VITE_CLAUDE_MODEL=claude-sonnet-4-6

VITE_OPENAI_API_KEY=           ← from platform.openai.com/api-keys (optional)
VITE_OPENAI_MODEL=gpt-4o
```

LinkedIn and WordPress fields can stay as placeholders — they're not used in the current clipboard mode.

---

## Things to remember

- **Never share your `.env` file.** It has your secret keys.
- **Always use Command Prompt, not PowerShell.** PowerShell blocks npm scripts on Windows.
- **Firebase test mode expires after 30 days.** After that, go to Firebase Console → Firestore → Rules and extend the expiry date or set proper security rules.
- **The app only works while `npm run dev` is running.** It's a development server, not a live website. To make it a real website, you'd need to run `npm run build` and host the `dist` folder somewhere.

---

## Summary of what we built

| What | Why |
|---|---|
| Vite + React setup | So we can develop with hot reload and build tools |
| `.env` file | To keep API keys secret and out of the code |
| Firebase Firestore | To save and load posts across sessions |
| Firebase Storage | To store uploaded images |
| Vite proxy | To get around CORS and talk to AI APIs from the browser |
| Claude + OpenAI support | Two AI options to choose from |
| Clipboard copy | Simpler than full API publishing for now |
| Tone selector | Control the writing style |
| 3 Variations | Compare options before committing |
| Char/word counter | Stay within LinkedIn's limits |
| Preview toggle | See how WordPress HTML looks before copying |
| Find & Replace | Edit content faster |
| `start.bat` | One double-click to start for non-technical users |
