/**
 * Static component-graph generator using the TypeScript Compiler API (no ts-morph). Scans .tsx
 * files for React components and emits nodes + edges (renders / imports / route). Shared by the
 * `dev-panel-graph` CLI and the Vite adapter. `typescript` is an optional peer dep — imported
 * dynamically with a friendly error if absent.
 */
import { join, sep, resolve, relative } from 'node:path';
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

import type { ComponentGraph, ComponentGraphNode, ComponentGraphEdge } from '../core/graph-types';

export interface GenerateOptions {
  /** Repo root (absolute). Default: process.cwd(). */
  root?: string;
  /** Directories to scan, relative to root. Default: ['src']. */
  scan?: string[];
  /** Output file, relative to root. Default: '.dev-panel/component-graph.json'. */
  out?: string;
}

export interface GenerateResult {
  graph: ComponentGraph;
  outFile: string;
  fileCount: number;
  duplicateNames: number;
}

const SKIP_DIR = new Set(['node_modules', 'dist', '.next', '.turbo', '__tests__', 'generated', '.git']);
const isComponentFile = (f: string) =>
  f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.endsWith('.stories.tsx');
const isPascal = (name: unknown): name is string => typeof name === 'string' && /^[A-Z]/.test(name);

function collectFiles(dir: string, out: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIR.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) collectFiles(full, out);
    else if (isComponentFile(entry)) out.push(full);
  }
  return out;
}

export async function generateComponentGraph(options: GenerateOptions = {}): Promise<GenerateResult> {
  let ts: typeof import('typescript');
  try {
    ts = (await import('typescript')).default ?? (await import('typescript'));
  } catch {
    throw new Error(
      "[dev-panel-graph] 'typescript' is required to generate the component graph. Install it: npm i -D typescript",
    );
  }

  const root = resolve(options.root ?? process.cwd());
  const scanDirs = (options.scan ?? ['src']).map((d) => resolve(root, d));
  const outFile = resolve(root, options.out ?? '.dev-panel/component-graph.json');
  const toRel = (abs: string) => relative(root, abs).split(sep).join('/');

  const files = scanDirs.flatMap((d) => collectFiles(d, []));

  const containsJsx = (node: import('typescript').Node): boolean => {
    let found = false;
    const visit = (n: import('typescript').Node) => {
      if (found) return;
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
        found = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };

  const jsxRoot = (tag: import('typescript').JsxTagNameExpression): string | null => {
    if (ts.isIdentifier(tag)) return tag.text;
    if (ts.isPropertyAccessExpression(tag)) {
      let expr: import('typescript').Expression = tag.expression;
      while (ts.isPropertyAccessExpression(expr)) expr = expr.expression;
      if (ts.isIdentifier(expr)) return expr.text;
    }
    return null;
  };

  const renderedIn = (node: import('typescript').Node): Set<string> => {
    const names = new Set<string>();
    const visit = (n: import('typescript').Node) => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const r = jsxRoot(n.tagName);
        if (r && isPascal(r)) names.add(r);
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return names;
  };

  const importedIn = (sf: import('typescript').SourceFile): Set<string> => {
    const names = new Set<string>();
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
      const clause = stmt.importClause;
      if (clause.isTypeOnly) continue;
      if (clause.name && isPascal(clause.name.text)) names.add(clause.name.text);
      const b = clause.namedBindings;
      if (b && ts.isNamedImports(b)) {
        for (const spec of b.elements) {
          if (spec.isTypeOnly) continue;
          if (isPascal(spec.name.text)) names.add(spec.name.text);
        }
      }
    }
    return names;
  };

  const hasExport = (node: import('typescript').Node): boolean =>
    !!(ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );

  const routeFor = (absPath: string): string | null => {
    const rel = toRel(absPath);
    const marker = '/app/';
    const idx = rel.indexOf(marker);
    if (idx === -1 || !rel.endsWith('/page.tsx')) return null;
    const inner = rel.slice(idx + marker.length, -'/page.tsx'.length);
    const segments = inner
      .split('/')
      .filter(Boolean)
      .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
      .map((s) => s.replace(/^\[\.\.\.(.+)\]$/, '*$1').replace(/^\[(.+)\]$/, ':$1'));
    return '/' + segments.join('/');
  };

  const nodesByName = new Map<string, ComponentGraphNode>();
  const edgeSet = new Set<string>();
  const edges: ComponentGraphEdge[] = [];
  let duplicateNames = 0;

  const addEdge = (from: string, to: string, type: ComponentGraphEdge['type']) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from, to, type });
  };

  const addNode = (
    name: string,
    sf: import('typescript').SourceFile,
    decl: import('typescript').Node,
    exported: boolean,
  ) => {
    if (nodesByName.has(name)) {
      duplicateNames += 1;
      return;
    }
    const pos = sf.getLineAndCharacterOfPosition(decl.getStart(sf));
    nodesByName.set(name, {
      id: name,
      name,
      filePath: toRel(sf.fileName),
      line: pos.line + 1,
      column: pos.character + 1,
      type: 'component',
      exported,
    });
  };

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const localComponents: Array<{ name: string; body: import('typescript').Node }> = [];

    for (const stmt of sf.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name && isPascal(stmt.name.text) && stmt.body) {
        if (containsJsx(stmt.body)) {
          addNode(stmt.name.text, sf, stmt, hasExport(stmt));
          localComponents.push({ name: stmt.name.text, body: stmt.body });
        }
      } else if (ts.isVariableStatement(stmt)) {
        const exported = hasExport(stmt);
        for (const decl of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !isPascal(decl.name.text) || !decl.initializer) continue;
          const init = decl.initializer;
          if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && containsJsx(init)) {
            addNode(decl.name.text, sf, decl, exported);
            localComponents.push({ name: decl.name.text, body: init });
          }
        }
      }
    }

    if (localComponents.length === 0) continue;

    const base = file.split(sep).pop()!.replace(/\.tsx$/, '');
    const primary =
      localComponents.find(
        (c) => c.name.toLowerCase() === base.replace(/[-_]/g, '').toLowerCase(),
      ) ?? localComponents[0];

    for (const comp of localComponents) {
      for (const rendered of renderedIn(comp.body)) addEdge(comp.name, rendered, 'renders');
    }
    for (const imported of importedIn(sf)) addEdge(primary.name, imported, 'imports');

    const route = routeFor(file);
    if (route) {
      const routeId = `route:${route}`;
      if (!nodesByName.has(routeId)) {
        nodesByName.set(routeId, { id: routeId, name: route, filePath: toRel(file), type: 'route', route });
      }
      const primaryNode = nodesByName.get(primary.name);
      if (primaryNode && !primaryNode.route) primaryNode.route = route;
      addEdge(routeId, primary.name, 'route');
    }
  }

  const known = new Set(nodesByName.keys());
  const prunedEdges = edges.filter((e) => known.has(e.from) && known.has(e.to));

  const graph: ComponentGraph = {
    root,
    generatedAt: new Date().toISOString(),
    nodes: [...nodesByName.values()],
    edges: prunedEdges,
  };

  mkdirSync(resolve(outFile, '..'), { recursive: true });
  writeFileSync(outFile, JSON.stringify(graph, null, 2), 'utf8');

  return { graph, outFile, fileCount: files.length, duplicateNames };
}
