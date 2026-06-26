# react-dev-panel

A **framework-agnostic, self-contained** floating dev panel for any React app — no MUI, no
Redux, no design-system coupling. One component, gated to internal/dev users, giving you:

- **Developer Logs** — live console + network capture
- **Page Performance** — Core Web Vitals with fix hints
- **Component Graph Inspector** — hover-to-source, component tree, "what's on this page", open-in-editor *(in progress — see Roadmap)*

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

## Roadmap

This is an active extraction from an internal monorepo. Shipping incrementally:

- [x] Framework-agnostic core (provider, launcher, self-contained styles, tool registry)
- [x] Developer Logs
- [x] Page Performance
- [ ] **Component Graph Inspector** — runtime overlay (hover/lock), component tree, "on this page", open-in-editor
- [ ] **CLI** `dev-panel-graph` — static component-graph generator (TypeScript Compiler API)
- [ ] **Adapters** — `react-dev-panel/next` (route handlers), `/vite` (plugin), `/server` (connect middleware) to serve the graph + open files in the running editor

## License

MIT
