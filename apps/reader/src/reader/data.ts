import type {
  Asset,
  AssetsDocument,
  DemoBundle,
  DirectionDocument,
  PlaybackDocument,
  SourceDocument,
} from "./types";

export const DEMO_BASE_URL = "/restaurant-demo";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${DEMO_BASE_URL}/${path}`);
  if (!response.ok) {
    throw new Error(`无法加载 ${path}（HTTP ${response.status}）`);
  }
  return (await response.json()) as T;
}

export async function loadDemoBundle(): Promise<DemoBundle> {
  const [source, direction, assets, playback] = await Promise.all([
    fetchJson<SourceDocument>("source.json"),
    fetchJson<DirectionDocument>("direction.json"),
    fetchJson<AssetsDocument>("assets.json"),
    fetchJson<PlaybackDocument>("playback.json"),
  ]);
  return { source, direction, assets, playback };
}

export function assetUrl(asset: Asset): string {
  return `${DEMO_BASE_URL}/${asset.path}`;
}

export function indexAssets(document: AssetsDocument): Map<string, Asset> {
  return new Map(document.assets.map((asset) => [asset.id, asset]));
}
