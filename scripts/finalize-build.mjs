import { readFile, writeFile, rm } from 'node:fs/promises';
const html = await readFile('dist/web/index.html', 'utf8');
await writeFile('dist/index.html', html);
await rm('dist/web', { recursive: true, force: true });
await writeFile('dist/.nojekyll', '');
