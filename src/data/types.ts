export type Platform = 'ios' | 'macos';
export type Frame = [number, number, number, number];
export interface Layer {
  id: string;
  name: string;
  type: string;
  f: Frame;
  path: string;
  hidden?: boolean;
  children?: Layer[];
  symbolID?: string;
  style?: Record<string, any>;
  text?: Record<string, any>;
  layout?: Record<string, any>;
  padding?: [number, number, number, number];
  overrides?: any[];
  [key: string]: any;
}
export interface Definition {
  id: string;
  name: string;
  platform: Platform;
  family: string;
  internal: boolean;
  symbolID: string;
  facets: { appearance: string; size: string; state: string };
  source: { member: string; pointer: string; nodeID: string; page: string };
  root: Layer;
}
export interface Family {
  id: string;
  name: string;
  zh: string;
  category: string;
  platforms: Platform[];
  count: number;
  publicCount: number;
}
export interface Database {
  components: Definition[];
  families: Family[];
  sources: any[];
  typography: Record<Platform, any[]>;
  [key: string]: any;
}
export interface MaterialStyle {
  id: string;
  platform: Platform;
  name: string;
  pointer: string;
  recipe: number;
  catalog: boolean;
}
export interface MaterialData {
  styles: MaterialStyle[];
  recipes: any[];
  bindings: Record<string, number[][]>;
  sources: any[];
  geometryPayloadSHA256: string;
  [key: string]: any;
}
