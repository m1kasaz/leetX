import type { StorageLike } from './captureLog';

export const GALLERY_KEY = 'leetx:gallery';
export const ACTIVE_KEY = 'leetx:galleryActive';
export const OPACITY_KEY = 'leetx:bgOpacity';
export const DEFAULT_OPACITY = 55;
export const GALLERY_MAX = 8;
// 图库总大小预算：给 chrome.storage.local 的 10MB 配额留出采集日志等其余数据的空间
export const GALLERY_MAX_BYTES = 7 * 1024 * 1024;

export interface GalleryImage {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export async function listImages(storage: StorageLike): Promise<GalleryImage[]> {
  const raw = (await storage.get(GALLERY_KEY))[GALLERY_KEY];
  return Array.isArray(raw) ? (raw as GalleryImage[]) : [];
}

export async function addImage(storage: StorageLike, value: GalleryImage): Promise<void> {
  const next = [value, ...(await listImages(storage)).filter((x) => x.id !== value.id)];
  const kept: GalleryImage[] = [];
  let total = 0;
  for (const img of next) {
    if (kept.length >= GALLERY_MAX) break;
    // base64 每 4 字符编码 3 字节；至少保留新上传的这张
    total += (img.dataUrl.length * 3) / 4;
    if (kept.length > 0 && total > GALLERY_MAX_BYTES) break;
    kept.push(img);
  }
  const items: Record<string, unknown> = { [GALLERY_KEY]: kept };
  const active = await getActiveId(storage);
  if (active && !kept.some((x) => x.id === active)) items[ACTIVE_KEY] = null;
  await storage.set(items);
}

export async function removeImage(storage: StorageLike, id: string): Promise<void> {
  const all = await listImages(storage);
  const items: Record<string, unknown> = { [GALLERY_KEY]: all.filter((x) => x.id !== id) };
  if ((await getActiveId(storage)) === id) items[ACTIVE_KEY] = null;
  await storage.set(items);
}

export async function getActiveId(storage: StorageLike): Promise<string | null> {
  const raw = (await storage.get(ACTIVE_KEY))[ACTIVE_KEY];
  return typeof raw === 'string' ? raw : null;
}

export async function setActiveId(storage: StorageLike, id: string | null): Promise<void> {
  await storage.set({ [ACTIVE_KEY]: id });
}

export async function getOpacity(storage: StorageLike): Promise<number> {
  const raw = (await storage.get(OPACITY_KEY))[OPACITY_KEY];
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_OPACITY;
}

export async function setOpacity(storage: StorageLike, value: number): Promise<void> {
  if (!Number.isFinite(value)) return;
  await storage.set({ [OPACITY_KEY]: Math.min(100, Math.max(0, Math.round(value))) });
}
