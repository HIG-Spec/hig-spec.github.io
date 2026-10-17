// Copy only generated site files. Application sources and unrelated files are untouched.
import { cp, rm, access } from 'node:fs/promises';
await access('dist/index.html');
await rm('site', { recursive: true, force: true });
for (const name of ['index.html', 'site', 'data', 'favicon.svg', '.nojekyll'])
  await cp('dist/' + name, name, { recursive: true });
