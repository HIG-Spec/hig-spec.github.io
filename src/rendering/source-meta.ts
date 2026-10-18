import snapshot from './source-metadata.json';
import type { Database, Layer } from '../data/types';
export interface Presentation {
  background?: boolean;
  mask?: number;
  breakMask?: boolean;
  graphic?: boolean;
  scale?: number;
  text?: {
    verticalAlignment?: number;
    behaviour?: number;
    lineBreakMode?: number;
    maximumNumberOfLines?: number;
  };
}
export const sourceMetadata = snapshot;
const metadata = new Map<string, Presentation>();
let loaded: Database | undefined;
/** Compact indices are bound once to the original, digest-pinned snapshot. */
export function initPresentation(db: Database) {
  if (loaded === db) return;
  for (const [platform, digest] of Object.entries(snapshot.sources)) {
    if (db.sources.find((s) => s.id === platform)?.sha256 !== digest)
      throw Error('Preview metadata source mismatch');
  }
  metadata.clear();
  const nodes = new Map<number, Layer[]>();
  for (const [ci, ni, flags] of snapshot.rows as [number, number, Presentation][]) {
    if (!nodes.has(ci)) {
      const flat: Layer[] = [];
      const walk = (n: Layer) => {
        flat.push(n);
        for (const c of n.children ?? []) walk(c);
      };
      walk(db.components[ci].root);
      nodes.set(ci, flat);
    }
    const node = nodes.get(ci)![ni];
    if (!node) throw Error('Invalid preview metadata binding');
    metadata.set(db.components[ci].platform + ':' + node.id, flags);
  }
  loaded = db;
}
export function presentation(n: Layer, platform: string): Presentation {
  return metadata.get(platform + ':' + n.id) ?? {};
}
