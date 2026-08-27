import { describe, expect, it } from 'vitest';
import { makeInMemoryStorage } from './captureLog';
import { addImage, getActiveId, getOpacity, GALLERY_MAX, listImages, removeImage, setActiveId, setOpacity } from './gallery';

function image(id: string, createdAt = 1) {
  return { id, name: `${id}.png`, dataUrl: `data:image/png;base64,${id}`, createdAt };
}

describe('gallery storage', () => {
  it('prepends new images so the newest comes first', async () => {
    const storage = makeInMemoryStorage();
    await addImage(storage, image('a', 1));
    await addImage(storage, image('b', 2));
    expect((await listImages(storage)).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('replaces an existing image with the same id', async () => {
    const storage = makeInMemoryStorage();
    await addImage(storage, image('a'));
    await addImage(storage, { ...image('a'), name: 'renamed.png' });
    const all = await listImages(storage);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('renamed.png');
  });

  it(`keeps at most ${GALLERY_MAX} images, dropping the oldest`, async () => {
    const storage = makeInMemoryStorage();
    for (let i = 0; i < GALLERY_MAX + 2; i++) await addImage(storage, image(`img-${i}`, i));
    const all = await listImages(storage);
    expect(all).toHaveLength(GALLERY_MAX);
    expect(all.map((x) => x.id)).not.toContain('img-0');
    expect(all.map((x) => x.id)).not.toContain('img-1');
    expect(all[0].id).toBe(`img-${GALLERY_MAX + 1}`);
  });

  it('returns an empty list when nothing was stored', async () => {
    expect(await listImages(makeInMemoryStorage())).toEqual([]);
  });

  it('removes images by id', async () => {
    const storage = makeInMemoryStorage();
    await addImage(storage, image('a'));
    await addImage(storage, image('b'));
    await removeImage(storage, 'b');
    expect((await listImages(storage)).map((x) => x.id)).toEqual(['a']);
  });

  it('clears the active id when the active image is removed', async () => {
    const storage = makeInMemoryStorage();
    await addImage(storage, image('a'));
    await setActiveId(storage, 'a');
    await removeImage(storage, 'a');
    expect(await getActiveId(storage)).toBeNull();
  });

  it('keeps the active id when another image is removed', async () => {
    const storage = makeInMemoryStorage();
    await addImage(storage, image('a'));
    await addImage(storage, image('b'));
    await setActiveId(storage, 'a');
    await removeImage(storage, 'b');
    expect(await getActiveId(storage)).toBe('a');
  });

  it('clears the active id when the count cap evicts the active image', async () => {
    const storage = makeInMemoryStorage();
    for (let i = 0; i < GALLERY_MAX; i++) await addImage(storage, image(`img-${i}`, i));
    await setActiveId(storage, 'img-0');
    await addImage(storage, image('img-new', 99));
    expect(await getActiveId(storage)).toBeNull();
  });

  it('evicts the oldest images when the total size exceeds the byte budget', async () => {
    const storage = makeInMemoryStorage();
    // 每张约 4MB，两张就超过 7MB 总量预算，数量远低于张数上限
    const big = 'x'.repeat(4 * 1024 * 1024);
    await addImage(storage, { ...image('old'), dataUrl: `data:image/jpeg;base64,${big}` });
    await addImage(storage, { ...image('mid'), dataUrl: `data:image/jpeg;base64,${big}` });
    await addImage(storage, { ...image('new'), dataUrl: `data:image/jpeg;base64,${big}` });
    const all = await listImages(storage);
    expect(all.map((x) => x.id)).toEqual(['new', 'mid']);
  });

  it('keeps at least the newly added image even if it alone exceeds the budget', async () => {
    const storage = makeInMemoryStorage();
    const huge = 'x'.repeat(8 * 1024 * 1024);
    await addImage(storage, { ...image('huge'), dataUrl: `data:image/jpeg;base64,${huge}` });
    expect((await listImages(storage)).map((x) => x.id)).toEqual(['huge']);
  });

  it('reads and writes the active id, defaulting to null', async () => {
    const storage = makeInMemoryStorage();
    expect(await getActiveId(storage)).toBeNull();
    await setActiveId(storage, 'a');
    expect(await getActiveId(storage)).toBe('a');
    await setActiveId(storage, null);
    expect(await getActiveId(storage)).toBeNull();
  });

  it('reads and writes the panel opacity, defaulting to 55', async () => {
    const storage = makeInMemoryStorage();
    expect(await getOpacity(storage)).toBe(55);
    await setOpacity(storage, 30);
    expect(await getOpacity(storage)).toBe(30);
  });

  it('clamps the opacity into 0-100 and rejects non-numbers', async () => {
    const storage = makeInMemoryStorage();
    await setOpacity(storage, 120);
    expect(await getOpacity(storage)).toBe(100);
    await setOpacity(storage, -5);
    expect(await getOpacity(storage)).toBe(0);
    await setOpacity(storage, Number.NaN);
    expect(await getOpacity(storage)).toBe(0);
  });
});
