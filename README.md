# Ava — Personal AI Tutor (Prototype)

A one-page voice tutoring app where you talk live with **Ava**, an AI personal tutor powered by Gemini Live. Built to test teaching style, explanations, and conversation feel — plus simple topic visualizations.

## What this prototype includes

- Live voice conversation (mic in, spoken tutor replies)
- On-screen transcript
- Interrupt / stop while Ava is speaking
- Friendly tutor avatar with listening / thinking / speaking states
- Auto-generated simple SVG visualizations for each explained topic

## What it does **not** include

Accounts, dashboards, quizzes, courses, payments, databases, or multi-page flows.

## Setup

1. Copy the env file and add your Gemini API key:

```bash
cp .env.example .env
```

Edit `.env` and set:

```
GEMINI_API_KEY=your_key_here
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Open **http://localhost:5173**

Allow microphone access, then click **Start session**.

## How it works

- The Express server (`server/`) holds `GEMINI_API_KEY` and issues short-lived **ephemeral tokens**.
- The browser connects directly to the **Gemini Live API** with that token (API key never ships to the client).
- When Ava explains a concept, she calls `show_visualization`; the server generates a simple SVG diagram with Gemini Flash.

## Scripts

| Command        | Purpose                          |
|----------------|----------------------------------|
| `npm run dev`  | API server + Vite frontend       |
| `npm run build`| Production frontend build        |
| `npm start`    | Serve API (+ built `dist/` if present) |

## Stack

- React + Vite + TypeScript
- Express
- `@google/genai` (Live API + Flash for diagrams)
