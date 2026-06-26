# react-dev-panel

A **framework-agnostic, self-contained** floating dev panel for any React app — no MUI, no
Redux, no design-system coupling. One component, gated to internal/dev users, giving you:

- **Developer Logs** — live console + network capture
- **Page Performance** — Core Web Vitals with fix hints
- **Component Graph Inspector** — hover-to-source, component tree, "what's on this page", open-in-editor

Styles are injected once under a `.rdp-root` scope, so the panel can't clash with — or be
clashed by — your app's theme. The only runtime requirement is React 18+.

## Install

```bash
npm i -D react-dev-panel
```

## Usage

Mount it once near your app root. It renders nothing in production by default.

```tsx
import { DevPanel } from 'react-dev-panel';

export function Providers({ children }) {
  return (
    <>
      {children}
      <DevPanel
        // Gate: who may see it. Defaults to NODE_ENV !== 'production'.
        enabled={process.env.NODE_ENV !== 'production' || user?.isInternal}
        // Current route, for tools that display it (optional).
        getRoute={() => location.pathname}
      />
    </>
  );
}
```

That's it — a draggable launcher appears in the corner.

### Configuration

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `enabled` | `boolean` | `NODE_ENV !== 'production'` | Master gate — the host owns the access decision. |
| `getRoute` | `() => string` | `location.pathname` | Current route for display. Adapters wire your router. |
| `openInEditor` | `(loc, editor?) => void` | protocol URL + copy | How source files open. Adapters provide a server-backed opener. |
| `graphEndpoint` | `string` | — | URL serving the component graph JSON (Component Graph Inspector). |
| `editor` | `'auto' \| 'vscode' \| 'cursor' \| 'webstorm' \| 'zed'` | `'auto'` | Preferred editor for protocol opens. |
| `theme` | `{ accent?, accentContrast? }` | purple | Accent color override. |
| `tools` | `string[]` | all | Restrict/reorder tools by id (`'logs'`, `'perf'`, `'graph'`). |

### Custom tools

```tsx
import { registerTool } from 'react-dev-panel';

registerTool({
  id: 'my-tool',
  title: 'My Tool',
  subtitle: 'Does a thing',
  icon: <MyIcon />,
  Panel: ({ onClose }) => <div>…</div>,
});
```

## Component Graph Inspector

Reliable component inspection that works in normal dev (Turbopack/Vite — no special build):

1. **Generate the graph** (components, files, parent/child/import/route edges):
   ```bash
   npx dev-panel-graph --scan src
   # → .dev-panel/component-graph.json
   ```
2. **Serve it + enable open-in-editor** with an adapter (below).
3. Open the panel → **Inspect mode** → hover (highlight + tooltip), click to lock, ⌘/Ctrl+click
   to open. Tabs: **Graph** (search + relationship tree), **Page** (what's mounted on this
   route), **File** (source + open).

Resolution climbs the React fiber tree to the nearest component that's in the graph, so hovering
a leaf still lands on your real app component. Open-in-editor uses the editor **running the
project** (`launch-editor`) — VS Code, Cursor, WebStorm, Zed, … — via the adapter endpoint.

### Adapters

**Vite**
```ts
import { devPanel } from 'react-dev-panel/vite';
export default defineConfig({ plugins: [react(), devPanel({ scan: ['src'] })] });
```

**Next.js (App Router)** — gate these yourself; dev/internal only.
```ts
// app/dev-panel/graph/route.ts
export const { GET } = createGraphRoute({ enabled: () => process.env.NODE_ENV !== 'production' });
// app/dev-panel/open-file/route.ts
export const { POST } = createOpenFileRoute({ enabled: () => process.env.NODE_ENV !== 'production' });
```

**Any Node server (CRA/Express/custom)**
```ts
import { createDevPanelMiddleware } from 'react-dev-panel/server';
app.use(createDevPanelMiddleware());
```

Then wire the client:
```tsx
import { DevPanel, serverOpenInEditor, DEFAULT_GRAPH_ENDPOINT } from 'react-dev-panel';
<DevPanel enabled={isDev} graphEndpoint={DEFAULT_GRAPH_ENDPOINT} openInEditor={serverOpenInEditor} />
```

Without an adapter the inspector still works at runtime (component names, tree from the graph if
served, page scan); open-in-editor falls back to `editor://` protocol URLs then copy.

## Roadmap

- [x] Framework-agnostic core (provider, launcher, self-contained styles, tool registry)
- [x] Developer Logs · Page Performance · Component Graph Inspector
- [x] CLI `dev-panel-graph` (TypeScript Compiler API)
- [x] Adapters: `/next`, `/vite`, `/server`
- [ ] Demo apps + browser-tested screenshots
- [ ] Optional Babel/SWC transform for exact element line:col

## License

MIT

