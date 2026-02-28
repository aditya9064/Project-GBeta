# OperonAI — CrewOS Platform

AI-powered business automation platform that converts natural language prompts into executable agents. Built with React, TypeScript, Firebase, and OpenAI.

## Features

- **AI Agent Builder** — Create automation agents from natural language prompts
- **Visual Workflow Editor** — Drag-and-drop workflow builder with node-based editor
- **Communications Agent** — Unified inbox for Gmail, Slack, and Teams with AI-drafted responses
- **Document Intelligence** — AI-powered document analysis, generation, and replication
- **Sales Intelligence** — CRM integration with deal tracking and lead scoring
- **Browser Automation** — AI Vision Agent that navigates websites using GPT-4o
- **Whiteboard** — Collaborative canvas with AI brainstorming
- **Calendar & Tasks** — Team scheduling and task management

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Express 5, Firebase Functions, Node.js 22 |
| Database | Firestore |
| Auth | Firebase Authentication |
| AI | OpenAI GPT-4o |
| Browser | Puppeteer |
| Integrations | Gmail, Slack, Teams, HubSpot |
| Deployment | Firebase Hosting, Docker |

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- Firebase project (optional for local dev)
- OpenAI API key

### Installation

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install
```

### Environment Setup

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Required variables:
- `OPENAI_API_KEY` — OpenAI API key for AI features
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth (optional)
- `SLACK_BOT_TOKEN` — Slack integration (optional)

### Development

```bash
# Start frontend dev server
npm run dev:source

# Start backend server (in another terminal)
cd server && npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`.

### Build & Deploy

```bash
# Build frontend
npm run build

# Deploy to Firebase
firebase deploy --only hosting,functions
```

## Project Structure

```
├── src/                    # Frontend React app
│   ├── components/         # UI components by feature
│   ├── contexts/           # React contexts (Auth, Agent)
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Frontend services
│   ├── styles/             # Global styles & design tokens
│   └── utils/              # Utility functions
├── server/                 # Backend Express server
│   └── src/
│       ├── routes/         # API route handlers
│       ├── services/       # Business logic services
│       └── middleware/     # Validation & middleware
├── public/                 # Static assets
└── docs/                   # Documentation
```

## License

Private — All rights reserved.
