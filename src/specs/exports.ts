import type { Definition } from '../data/types';
import { database, byID, clean } from '../data/store';
import { resolve } from './materials.js';
import { metrics, isStack } from './measurements';
export function componentExport(c: Definition) {
  return {
    format: 'hig-spec/component/1',
    unit: 'pt',
    source: database.value?.sources.find((s) => s.id === c.platform),
    component: byID.get(c.previewOf ?? c.id) ?? c,
    ...(c.previewOf
      ? {
          previewComposition: {
            label: c.previewLabel,
            sourceComponent: c.previewOf,
            substitutions: c.substitutions,
          },
        }
      : {}),
    materials: resolve(c),
  };
}
export function download(value: unknown, name: string, mime = 'application/json') {
  const blob = new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], {
    type: mime + ';charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportComponent(c: Definition, format: 'json' | 'md' | 'rs') {
  const base = clean(c.name).replace(/[^a-zA-Z0-9-]+/g, '-');
  if (format === 'json') return download(componentExport(c), base + '.json');
  if (format === 'md')
    return download(
      `# ${clean(c.name)}\n${c.previewOf ? `\n子部件状态组合：${c.previewLabel}\n\n${JSON.stringify(c.substitutions)}\n` : ''}\n| 参数 | 值 |\n|---|---|\n${metrics(
        c.root,
      )
        .map(([k, v]) => `| ${k} | ${v} |`)
        .join('\n')}\n\n## 材质\n\n\`\`\`json\n${JSON.stringify(resolve(c), null, 2)}\n\`\`\`\n`,
      base + '.md',
      'text/markdown',
    );
  const p = isStack(c.root) ? c.root.padding : undefined;
  const f = (x: number) => (Number.isInteger(x) ? x + '.0' : String(x));
  download(
    `// ${clean(c.name)}\n// Source snapshot; sample frame in design points.\n${c.previewOf ? `// Preview composition: ${c.previewLabel}\n// ${JSON.stringify(c.substitutions)}` : ''}\npub const SAMPLE_SIZE: [f32; 2] = [${f(c.root.f[2])}, ${f(c.root.f[3])}];\n${p ? `pub const PADDING_TRBL: [f32; 4] = [${p.map(f).join(', ')}];\n` : ''}\n// Full material recipe (unchanged source precision):\npub const MATERIAL_JSON: &str = r###"${JSON.stringify(resolve(c))}"###;\n`,
    base + '.rs',
    'text/plain',
  );
}
