# Bug Report Enhancer 🐛

A full-stack TypeScript application that lets you **drag-and-drop a screenshot**, optionally add notes, analyze the screenshot using **Groq's Llama 4 Scout** vision model, and automatically create a **Jira bug ticket**.

## Features

- 📸 Drag & drop screenshot upload
- 🤖 AI-powered bug analysis using Groq Llama 4 Scout (free tier)
- 🎫 Automatic Jira ticket creation
- ⚙️ Settings panel with Jira & Groq connection testing
- 📋 Project picker that fetches real Jira projects
- 🌙 Premium dark theme UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + TypeScript |
| Backend (local) | Express + TypeScript |
| Backend (Vercel) | Vercel Serverless Functions |
| AI Vision | Groq SDK (`meta-llama/llama-4-scout-17b-16e-instruct`) |
| Issue Tracker | Jira REST API v2/v3 |

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173 in Chrome.

## Setup

1. Click **SETTINGS** in the app
2. Enter your **Jira URL** (e.g. `https://yourcompany.atlassian.net`)
3. Enter your **Jira Email** and **API Token** ([create one here](https://id.atlassian.com/manage-profile/security/api-tokens))
4. Click **Load Projects** and select your project
5. Enter your **Groq API Key** ([get one here](https://console.groq.com/keys))
6. Click **Save Settings**

## Deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `JIRA_URL`
   - `JIRA_EMAIL`
   - `JIRA_API_TOKEN`
   - `JIRA_PROJECT_KEY`
   - `JIRA_ISSUE_TYPE` (default: Bug)
   - `GROQ_API_KEY`
4. Deploy!

## License

MIT
