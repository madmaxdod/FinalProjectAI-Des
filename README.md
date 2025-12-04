# FinalProjectAI-Des

This workspace contains a Vite + React single-file app (`src/App.jsx`) implementing a Real-Time YouTube VJ Interface designed to connect to local backends:

- WebSocket bridge: `ws://localhost:3001` (already expected to exist)
- YouTube search proxy: `http://localhost:3000/api/search?q=...` (already expected to exist)

Quick setup

1. Install dependencies
```bash
npm install
```

2. Run the dev server
```bash
npm run dev
```

3. Build for production
```bash
npm run build
npm run preview
```

Notes
- The core UI is in `src/App.jsx` (single-file React component). It uses the YouTube IFrame API and opens a WebSocket to `ws://localhost:3001` to emit events when the user seeks, changes rate, plays/pauses, or taps trigger buttons.
- The search box queries `http://localhost:3000/api/search?q={query}`. Adjust the proxy/back-end as needed.

If you'd like, I can:
- Run `npm install` and start the dev server in this container now.
- Adjust the UI layout, styles, or the exact websocket event payload format.
