<p align="center">
  <img src="public/logo-openlina-full.png" alt="OpenLina" width="720" />
</p>

<h1 align="center">OpenLina</h1>

<p align="center">
  <em>Local-first GUI to orchestrate AI agents that build webs and apps using your already-installed CLIs and APIs.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-early--development-orange" alt="status: early development" />
  <img src="https://img.shields.io/badge/stability-experimental-red" alt="stability: experimental" />
</p>

---

> ## ⚠️ Heads up — Work In Progress
>
> **OpenLina is in active, early development.** Things are rough, things are broken, and things will change without warning.
>
> - Features may be half-finished or missing entirely.
> - APIs, configs and workspace formats can break between commits.
> - Expect crashes, weird UI states, and the occasional "why did it do that?" moment.
> - **Do not use it for anything critical yet.**
>
> If you want to play with it, report bugs, or open PRs — amazing. Just go in knowing it's not production-ready.

---

## What is L.I.N.A.?

**L.I.N.A.** stands for **Local Intelligent Native Assistant**.

It's the brain behind OpenLina: a layer that coordinates the AI agents you already have on your machine (Claude Code, Codex, Gemini CLI, etc.) and gets them working together on your projects without depending on cloud services or extra subscriptions. You open OpenLina, pick a workspace, and L.I.N.A. takes care of dispatching tasks, holding context, and showing you what's happening in real time.

The idea is simple: **your machine, your tools, your keys, your data**. Nothing leaves your computer unless you say so.

## Why is it called Lina?

Because **Lina is my dog** 🐶. When I started hacking on this project she was sleeping at my feet, so the name stuck. She's loyal, she listens, and she always knows who to pay attention to — exactly what I wanted this assistant to be.

## Features (planned & partially working)

- **Local-first**: runs entirely on your machine, no mandatory telemetry.
- **Multi-agent**: orchestrates several AI CLIs at once over the same workspace.
- **Integrated terminal**: xterm + node-pty so you can see and control what each agent does.
- **Real-time**: Socket.IO communication between the server and the UI.
- **Workspaces**: separates projects, configs and context.

> Not all of these are stable yet. Some are scaffolded, some are flaky, some just plain don't work. See the issues tab.

## Requirements

- Node.js `>= 22.5.0`
- Linux / macOS / WSL2
- Any AI CLI you already use (optional, but recommended)

## Installation

```bash
npm install -g openlina
openlina
```

Or from the repo:

```bash
git clone https://github.com/FurneDesigns/OpenLina.git
cd OpenLina
npm install
npm run dev
```

Open `http://localhost:3747` and have fun (carefully).

## Scripts

| Command           | What it does                              |
|-------------------|-------------------------------------------|
| `npm run dev`     | Start in development mode                 |
| `npm run build`   | Build for production                      |
| `npm start`       | Start the server in production            |
| `npm run restart` | Kill the port, clean the cache and reboot |

## Stack

Next.js 14 · React 18 · TypeScript · Tailwind · Socket.IO · node-pty · Zustand · @xenova/transformers

## Contributing

Bug reports and PRs are very welcome — just remember the project is early and moving fast, so check open issues before starting big work.

## License

MIT — do whatever you want, but if it helps, drop a ⭐.
