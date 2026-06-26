#!/usr/bin/env node
/**
 * dev-panel-graph — generate the static component graph for the Component Graph Inspector.
 *
 *   npx dev-panel-graph                       # scan ./src → .dev-panel/component-graph.json
 *   npx dev-panel-graph --scan src,packages/ui/src --out .dev-panel/graph.json
 *   npx dev-panel-graph --root /path/to/repo
 */
import { generateComponentGraph } from './generate';

function parseArgs(argv: string[]): { root?: string; scan?: string[]; out?: string } {
  const out: { root?: string; scan?: string[]; out?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--root' && next) (out.root = next), (i += 1);
    else if (arg === '--scan' && next) (out.scan = next.split(',').map((s) => s.trim()).filter(Boolean)), (i += 1);
    else if (arg === '--out' && next) (out.out = next), (i += 1);
    else if (arg === '--help' || arg === '-h') {
      // eslint-disable-next-line no-console
      console.log(
        'Usage: dev-panel-graph [--root <dir>] [--scan <dir,dir>] [--out <file>]\n' +
          '  --root  repo root (default: cwd)\n' +
          '  --scan  dirs to scan, comma-separated (default: src)\n' +
          '  --out   output JSON path (default: .dev-panel/component-graph.json)',
      );
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { graph, outFile, fileCount, duplicateNames } = await generateComponentGraph(opts);
  // eslint-disable-next-line no-console
  console.log(
    `[dev-panel-graph] ${graph.nodes.length} nodes, ${graph.edges.length} edges from ${fileCount} files` +
      (duplicateNames ? ` (${duplicateNames} duplicate names, first-wins)` : '') +
      `\n[dev-panel-graph] → ${outFile}`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
