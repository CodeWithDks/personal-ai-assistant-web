# AI Companion UI

Build a modern, animated productivity web app called "Personal AI Assistant" —

a personal task/notes manager with an AI chat assistant. This is a

frontend-only build for now: use mock/local state, no real backend, no

Supabase, and no authentication logic — just the UI and interactions.

Tech: React + TypeScript + Tailwind CSS + shadcn/ui, with smooth,

tasteful animations/transitions throughout (Framer Motion style).

For this first step, build ONLY the foundation:

1. A cohesive design system:

   - Primary accent: a deep teal (#1F6F64 in light mode, a brighter

     teal like #42B0A0 in dark mode)

   - Neutrals: warm off-white/paper background in light mode, warm

     charcoal (not pure black) in dark mode

   - Supporting colors: amber/orange for warnings, muted red for

     danger/delete actions, green for success

   - Typography: a distinctive serif display font for headings (like

     Fraunces), a clean sans-serif for body text (like IBM Plex Sans),

     and a monospace font (like IBM Plex Mono) used specifically for

     AI/system-generated content — chat replies, timestamps, status

     badges — as a deliberate visual signature distinguishing "what

     the user typed" from "what the system says"

   - An animated light/dark mode toggle, persisted across reloads,

     defaulting to the system preference

2. The overall app shell:

   - A polished header/branding area

   - A sidebar with navigation between "Chat" mode and "Tasks & Notes"

     mode, plus the theme toggle and a logout button (no real logout

     logic needed yet — just the UI)

   - Fully responsive, works well on mobile

3. Subtle, modern motion: page/section transitions, hover states,

   button micro-interactions — polished but not distracting

Don't build the actual chat, tasks, or notes screens yet — just the

shell, navigation, and empty placeholder content areas for each mode.

We'll build those in the next steps.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://personal-assistant-09.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e8656b58-3ddb-4d45-b954-771fd5989d22).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
