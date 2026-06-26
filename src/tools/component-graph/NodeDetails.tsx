'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import { LuCopy, LuFileCode, LuClipboardCopy } from 'react-icons/lu';

import type { Selected } from './store';

function Chips({ names, onSelect }: { names: string[]; onSelect: (n: string) => void }) {
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {names.map((n) => (
        <Chip key={n} label={n} size="small" variant="outlined" onClick={() => onSelect(n)} sx={{ height: 18, fontSize: '0.62rem', fontFamily: 'monospace' }} />
      ))}
    </Stack>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
      <Typography variant="caption" sx={{ minWidth: 56, color: 'text.disabled', fontWeight: 600, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Stack>
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
      <Typography variant="body2" sx={{ color: 'text.disabled', px: 0.5, py: 1 }}>
        Nothing selected. Enable inspect mode and click a component, or pick one from the tree.
      </Typography>
    );
  }
  return (
    <Box sx={(t) => ({ p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: alpha(t.palette.grey[500], 0.06) })}>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Chip label={selected.componentName} size="small" color="primary" variant="soft" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
        {selected.domTag && (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{`<${selected.domTag}>`}</Typography>
        )}
      </Stack>

      {selected.filePath ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontFamily: 'monospace', fontSize: '0.68rem', wordBreak: 'break-all', color: 'text.secondary' }}>
          {selected.filePath}
          {selected.line ? `:${selected.line}` : ''}
          {selected.line && selected.column ? `:${selected.column}` : ''}
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'warning.main' }}>
          No source path — run the graph generator (npx dev-panel-graph) or mount an adapter.
        </Typography>
      )}

      {selected.route && (
        <Row label="Route">
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {selected.route}
          </Typography>
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
          <Box sx={{ fontFamily: 'monospace', fontSize: '0.66rem', color: 'text.secondary' }}>
            {selected.props.map((p) => (
              <Box key={p.name} component="span" sx={{ mr: 1, display: 'inline-block' }}>
                <Box component="span" sx={{ color: 'primary.main' }}>
                  {p.name}
                </Box>
                ={p.value}
              </Box>
            ))}
          </Box>
        </Row>
      )}

      <Button fullWidth variant="contained" startIcon={<LuFileCode size={14} />} onClick={onOpen} sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.4, mt: 1.25 }}>
        Open in editor
      </Button>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Tooltip title="Copy component info" placement="top">
          <IconButton size="small" onClick={onCopyInfo} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <LuClipboardCopy size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Copy file path" placement="top">
          <span>
            <IconButton size="small" onClick={onCopyPath} disabled={!selected.filePath && !selected.absFilePath} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <LuCopy size={15} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
