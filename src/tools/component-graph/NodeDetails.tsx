import type { Selected } from './store';
import { cx } from '../../core/styles';
import { IconCopy, IconFileCode } from '../../core/icons';

function Chips({ names, onSelect }: { names: string[]; onSelect: (n: string) => void }) {
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {names.map((n) => (
        <button
          key={n}
          type="button"
          className="rdp-chip rdp-mono"
          style={{ border: '1px solid var(--rdp-border)', background: 'transparent', color: 'var(--rdp-text)', cursor: 'pointer' }}
          onClick={() => onSelect(n)}
        >
          {n}
        </button>
      ))}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
      <span style={{ minWidth: 52, color: 'var(--rdp-text-faint)', fontWeight: 600, flexShrink: 0, fontSize: 11 }}>
        {label}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>{children}</span>
    </div>
  );
}

export function NodeDetails({
  selected,
  onOpen,
  onCopyInfo,
  onCopyPath,
  onSelectName,
}: {
  selected: Selected | null;
  onOpen: () => void;
  onCopyInfo: () => void;
  onCopyPath: () => void;
  onSelectName: (name: string) => void;
}) {
  if (!selected) {
    return (
      <div style={{ color: 'var(--rdp-text-faint)', padding: '6px 2px' }}>
        Nothing selected. Enable inspect mode and click a component, or pick one from the tree.
      </div>
    );
  }
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 9,
        border: '1px solid var(--rdp-border)',
        background: 'var(--rdp-bg-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="rdp-chip" style={{ background: 'rgba(105,80,232,0.22)', color: 'var(--rdp-accent)' }}>
          {selected.componentName}
        </span>
        {selected.domTag && (
          <span className="rdp-mono" style={{ color: 'var(--rdp-text-faint)', fontSize: 11 }}>{`<${selected.domTag}>`}</span>
        )}
      </div>

      {selected.filePath ? (
        <div className="rdp-mono" style={{ marginTop: 6, fontSize: 11.5, color: 'var(--rdp-text-dim)', wordBreak: 'break-all' }}>
          {selected.filePath}
          {selected.line ? `:${selected.line}` : ''}
          {selected.line && selected.column ? `:${selected.column}` : ''}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--rdp-warning)' }}>
          No source path — run the graph generator (npx dev-panel-graph) or mount an adapter.
        </div>
      )}

      {selected.route && (
        <Row label="Route">
          <span className="rdp-mono" style={{ fontSize: 12 }}>{selected.route}</span>
        </Row>
      )}
      {selected.parent && (
        <Row label="Parent">
          <Chips names={[selected.parent]} onSelect={onSelectName} />
        </Row>
      )}
      {selected.children.length > 0 && (
        <Row label="Renders">
          <Chips names={selected.children} onSelect={onSelectName} />
        </Row>
      )}
      {selected.imports.length > 0 && (
        <Row label="Imports">
          <Chips names={selected.imports} onSelect={onSelectName} />
        </Row>
      )}
      {selected.props && selected.props.length > 0 && (
        <Row label="Props">
          <span className="rdp-mono" style={{ fontSize: 11, color: 'var(--rdp-text-dim)' }}>
            {selected.props.map((p) => (
              <span key={p.name} style={{ marginRight: 8, display: 'inline-block' }}>
                <span style={{ color: 'var(--rdp-accent)' }}>{p.name}</span>={p.value}
              </span>
            ))}
          </span>
        </Row>
      )}

      <button type="button" className={cx('rdp-btn', 'rdp-btn-primary')} style={{ marginTop: 12 }} onClick={onOpen}>
        <IconFileCode size={14} /> Open in editor
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="rdp-iconbtn" onClick={onCopyInfo} title="Copy component info">
          <IconCopy size={15} />
        </button>
        <button
          type="button"
          className="rdp-iconbtn"
          onClick={onCopyPath}
          disabled={!selected.filePath && !selected.absFilePath}
          title="Copy file path"
        >
          <IconFileCode size={15} />
        </button>
      </div>
    </div>
  );
}
