# react-dev-panel

A floating, in-app **developer panel for any React project** — drop in one component and get a
draggable launcher with three tools:

- 🐛 **Developer Logs** — live console + network capture (status, duration, GraphQL op name/type,
  request/response bodies & headers), with source/level filters, search, "this page" scoping, and
  expandable entries.
- 📊 **Page Performance** — Core Web Vitals (LCP, INP, CLS, FCP, TTFB) with ratings and fix hints.
- 🧩 **Component Graph Inspector** — hover any element to identify its component, lock it, browse
  the **parent → renders → imports** tree, see **what's mounted on the current page**, and **open
  the source file in your editor**.

Built on **MUI** (peer dependency) so it inherits your app's theme. Gating is a prop you control —
nothing renders in production unless you say so.

---

## Table of contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Tools](#tools)
- [Component Graph Inspector setup](#component-graph-inspector-setup)
  - [1. Generate the graph](#1-generate-the-graph)
  - [2. Serve it (pick an adapter)](#2-serve-it-pick-an-adapter)
  - [3. Wire the client](#3-wire-the-client)
- [Open-in-editor](#open-in-editor)
- [Gating & security](#gating--security)
- [Custom tools](#custom-tools)
- [Theming](#theming)
- [CLI reference](#cli-reference)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Requirements

`react-dev-panel` renders inside your app's existing MUI `ThemeProvider`, so these are **peer
dependencies** you already have in an MUI app:

| Peer | Version |
| --- | --- |
| `react` / `react-dom` | `>=18` |
| `@mui/material` | `>=7` |
| `@emotion/react`, `@emotion/styled` | `>=11` |
| `react-icons` | `>=5` |
| `typescript` *(optional)* | `>=5` — only the graph-generator CLI uses it |

> Not using MUI? This package won't render correctly without an MUI theme in context. (A
> style-agnostic build is out of scope for now.)

## Install

```bash
npm i -D react-dev-panel
# or: pnpm add -D react-dev-panel   /   yarn add -D react-dev-panel
```

## Quick start

Mount `<DevPanel/>` **once**, near your app root, **inside your MUI `ThemeProvider`**. It renders
nothing in production by default.

```tsx
import { DevPanel } from 'react-dev-panel';

export function Providers({ children }) {
  return (
    <ThemeProvider theme={theme}>
      {children}
      <DevPanel enabled={process.env.NODE_ENV !== 'production'} />
    </ThemeProvider>
  );
}
```

A draggable wrench launcher appears in a corner. Open it → **Developer Logs** and **Page
Performance** work immediately with zero further setup.

The **Component Graph Inspector** needs a generated graph + a way to open files — see
[its setup section](#component-graph-inspector-setup). Until then, its hover/lock still identifies
components by name (from the React fiber tree); file paths and relationships light up once the
graph is served.

## Configuration

`<DevPanel/>` takes a flat config object:

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `process.env.NODE_ENV !== 'production'` | Master gate. **You** own the access decision (env, internal-user role, flag). |
| `getRoute` | `() => string \| undefined` | `location.pathname` | Current route, for the "this page" / route displays. Wire your router (see per-framework notes). |
| `openInEditor` | `(loc, editor?) => void \| Promise<void \| boolean>` | protocol URL + copy | How source files open. Use `serverOpenInEditor` with an adapter for the best result. |
| `graphEndpoint` | `string` | — | URL serving the component-graph JSON. Use `DEFAULT_GRAPH_ENDPOINT` with an adapter. |
| `editor` | `'auto' \| 'vscode' \| 'cursor' \| 'webstorm' \| 'zed'` | `'auto'` | Preferred editor. `auto` lets the server detect the editor running the project. |
| `theme` | `{ accent?: string; accentContrast?: string }` | — | Minor accent overrides (most styling comes from your MUI theme). |
| `tools` | `string[]` | all | Restrict/reorder tools by id: `'logs'`, `'perf'`, `'graph'`. |

Example, fully wired (Next.js):

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { DevPanel, serverOpenInEditor, DEFAULT_GRAPH_ENDPOINT } from 'react-dev-panel';

export function DevPanelMount() {
  const pathname = usePathname();
  return (
    <DevPanel
      enabled={process.env.NODE_ENV !== 'production'}
      getRoute={() => pathname ?? undefined}
      graphEndpoint={DEFAULT_GRAPH_ENDPOINT}
      openInEditor={serverOpenInEditor}
      tools={['graph', 'logs', 'perf']}
    />
  );
}
```

## Tools

| Tool | id | Setup | Notes |
| --- | --- | --- | --- |
| Developer Logs | `logs` | none | Patches `console` + `fetch`/XHR on first mount. Persists to `sessionStorage` (per tab). |
| Page Performance | `perf` | none | Uses `web-vitals`. INP needs an interaction before it reports. |
| Component Graph Inspector | `graph` | graph + endpoint | See below. Degrades gracefully without them. |

## Component Graph Inspector setup

Three steps: **generate** the graph, **serve** it, **wire** the client.

### 1. Generate the graph

A CLI scans your source with the TypeScript compiler and writes a JSON graph (components, files,
lines, and `renders` / `imports` / `route` edges):

```bash
npx dev-panel-graph --scan src
# → .dev-panel/component-graph.json
```

Re-run it after adding/moving components. Common options:

```bash
npx dev-panel-graph --scan src,packages/ui/src --out .dev-panel/graph.json --root .
```

Add it to your scripts so it's easy to refresh:

```jsonc
// package.json
"scripts": {
  "gen:dev-panel": "dev-panel-graph --scan src"
}
```

Gitignore the output:

```gitignore
.dev-panel/
```

### 2. Serve it (pick an adapter)

The graph JSON lives outside `public/`, so a tiny dev endpoint serves it (and opens files). Pick
the adapter for your stack — all three mount the same two endpoints
(`/dev-panel/graph`, `/dev-panel/open-file`).

**Vite** — one line; also regenerates the graph on dev start:

```ts
// vite.config.ts
import { devPanel } from 'react-dev-panel/vite';

export default defineConfig({
  plugins: [react(), devPanel({ scan: ['src'] })],
});
```

**Next.js (App Router)** — add two route files (gate them yourself; dev/internal only):

```ts
// app/dev-panel/graph/route.ts
import { createGraphRoute } from 'react-dev-panel/next';
export const dynamic = 'force-dynamic';
export const { GET } = createGraphRoute({
  enabled: () => process.env.NODE_ENV !== 'production',
});
```

```ts
// app/dev-panel/open-file/route.ts
import { createOpenFileRoute } from 'react-dev-panel/next';
export const dynamic = 'force-dynamic';
export const { POST } = createOpenFileRoute({
  enabled: () => process.env.NODE_ENV !== 'production',
});
```

> In a monorepo where `cwd` differs from the repo root, pass `root` / `graphFile`:
> `createGraphRoute({ root: path.resolve(process.cwd(), '../..'), graphFile: 'apps/web/.dev-panel/component-graph.json' })`.

**Any Node server (CRA proxy / Express / custom)** — connect-style middleware:

```ts
import { createDevPanelMiddleware } from 'react-dev-panel/server';
app.use(createDevPanelMiddleware());
```

### 3. Wire the client

Point `<DevPanel/>` at the served endpoint and the server-backed opener:

```tsx
import { DevPanel, serverOpenInEditor, DEFAULT_GRAPH_ENDPOINT } from 'react-dev-panel';

<DevPanel enabled={isDev} graphEndpoint={DEFAULT_GRAPH_ENDPOINT} openInEditor={serverOpenInEditor} />
```

That's it — open the panel, enable **Inspect mode**, hover, click to lock, and use the **Graph**,
**Page**, and **File** tabs.

> **No adapter / fully client-only?** Omit `graphEndpoint`. Hover still names components and the
> Page scan still lists them; file paths/relationships require the served graph, and open-in-editor
> falls back to `editor://` protocol URLs (then copy).

## Open-in-editor

The detail card has a primary **Open in editor** button plus a `force:` row (**VS Code / Cursor /
WebStorm**). Resolution order:

1. **Server** (`openInEditor={serverOpenInEditor}` + an adapter) → posts to `/dev-panel/open-file`,
   which runs [`launch-editor`](https://www.npmjs.com/package/launch-editor) and opens the editor
   **running the project** (respects `$EDITOR`). Most reliable. The `force:` buttons map to
   `code` / `cursor` / `webstorm` CLIs — those must be on your `PATH`.
2. **Protocol** (default opener, no server) → `vscode://` / `cursor://` / `webstorm://` / `zed://`.
3. **Copy** the path to the clipboard if both fail.

`⌘/Ctrl + click` on a hovered element opens it directly.

## Gating & security

- `enabled` is the master switch and **defaults to non-production**. In production it renders
  nothing unless you explicitly pass `enabled` truthy — gate that on an internal-user role/flag.
- The adapter endpoints accept an `enabled()` callback — **gate them too** (NODE_ENV and/or auth);
  they 404 in production by default.
- Open-file requests are **confined to the repo root** (path-traversal guarded).
- The graph JSON is read from disk by the endpoint and is **not** placed under `public/`, so it's
  never a statically served production asset. Keep `.dev-panel/` gitignored.
- Sensitive request headers (`authorization`, `cookie`, …) are **redacted** before logging, and
  presigned URL signatures are collapsed.

## Custom tools

Register your own tool before mounting `<DevPanel/>`:

```tsx
import { registerTool } from 'react-dev-panel';
import { LuFlask } from 'react-icons/lu';

registerTool({
  id: 'my-tool',
  title: 'My Tool',
  subtitle: 'Does a useful thing',
  color: 'primary', // primary | info | warning | success | error
  icon: <LuFlask size={19} />,
  Panel: ({ onClose }) => <YourMuiPanel onClose={onClose} />,
  // optional:
  Overlay: MyAlwaysMountedOverlay,          // self-gating layer
  useBadge: () => ({ label: '3', tone: 'error' }), // menu-row badge
  init: () => { /* one-time setup on mount */ },
});
```

Restrict/reorder which tools show with the `tools` prop.

## Theming

The panel uses your app's MUI theme — colors, radius, typography all follow it automatically.

- Tweak the launcher accent via `theme={{ accent: '#6950E8' }}`.
- The detail chips use MUI's `soft` Chip variant. If your theme registers `soft` (e.g. the
  Minimals template) it renders tinted; otherwise it falls back to a plain chip. No action needed.

## CLI reference

```text
dev-panel-graph [--root <dir>] [--scan <dir,dir>] [--out <file>]

  --root   repo root (default: cwd) — file paths in the graph are relative to this
  --scan   comma-separated dirs to scan (default: src)
  --out    output JSON path (default: .dev-panel/component-graph.json)
```

The Vite adapter runs this for you on dev-server start (`generateOnStart`, default `true`).

## API reference

**`react-dev-panel`**
- `DevPanel(config)` — the mountable component.
- `registerTool(def)`, `getRegisteredTools()` — custom tools.
- `serverOpenInEditor`, `createServerOpenInEditor(endpoint?)` — client opener that POSTs to the
  open-file endpoint.
- `defaultOpenInEditor` — protocol-URL + copy opener (used when none is provided).
- `useDevPanelConfig()` — read the resolved config inside a custom tool.
- `DEFAULT_GRAPH_ENDPOINT`, `DEFAULT_OPEN_ENDPOINT` — `'/dev-panel/graph'`, `'/dev-panel/open-file'`.
- Types: `DevPanelConfig`, `DevPanelTheme`, `ToolDefinition`, `ToolPanelProps`, `EditorType`,
  `SourceLocation`, `OpenInEditor`, `ComponentGraph`, `ComponentGraphNode`, `ComponentGraphEdge`.

**`react-dev-panel/next`** — `createGraphRoute(opts)`, `createOpenFileRoute(opts)` (+ the endpoint
constants and `serverOpenInEditor`).
**`react-dev-panel/vite`** — `devPanel(opts)` (default + named export).
**`react-dev-panel/server`** — `createDevPanelMiddleware(opts)`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Launcher doesn't appear | Check `enabled` is truthy; ensure it's mounted inside your MUI `ThemeProvider`. |
| Panels look unstyled / wrong colors | It must render inside an MUI `ThemeProvider`. |
| Graph tab says "not generated" | Run `npx dev-panel-graph`, then click **Retry graph load** (or reload). Confirm the adapter is mounted and `graphEndpoint` matches. |
| Hover shows `MuiButtonBaseRoot` / a host tag | You hovered a low-level/MUI element. Hover a container, or use **Graph → search** / the **Page** tab to find your app components. The resolver climbs to the nearest component that's in the graph. |
| "Open in editor" copies instead of opening | With an adapter: ensure the editor CLI (`code`/`cursor`/`webstorm`) is on `PATH`, or set `$EDITOR` before starting dev. Without an adapter, it relies on the OS protocol handler. |
| Page tab empty after navigation | Click **Rescan** — heavy/async pages mount content after the auto-scan. |

## License

MIT
