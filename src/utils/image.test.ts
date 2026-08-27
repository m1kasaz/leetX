import { describe, expect, it } from 'vitest';
import { isAcceptedImage, MAX_DATA_URL_BYTES } from './image';

function file(name: string, type: string) {
  return new File(['x'], name, { type });
}

describe('isAcceptedImage', () => {
  it('accepts jpeg and png mime types', () => {
    expect(isAcceptedImage(file('a.jpg', 'image/jpeg'))).toBe(true);
    expect(isAcceptedImage(file('a.jpeg', 'image/jpeg'))).toBe(true);
    expect(isAcceptedImage(file('a.png', 'image/png'))).toBe(true);
  });

  it('falls back to the extension when the mime type is empty', () => {
    expect(isAcceptedImage(file('a.JPG', ''))).toBe(true);
    expect(isAcceptedImage(file('a.jpeg', ''))).toBe(true);
    expect(isAcceptedImage(file('a.PnG', ''))).toBe(true);
  });

  it('rejects other image formats and non-images', () => {
    expect(isAcceptedImage(file('a.gif', 'image/gif'))).toBe(false);
    expect(isAcceptedImage(file('a.webp', 'image/webp'))).toBe(false);
    expect(isAcceptedImage(file('a.svg', 'image/svg+xml'))).toBe(false);
    expect(isAcceptedImage(file('a.txt', 'text/plain'))).toBe(false);
    expect(isAcceptedImage(file('a.gif', ''))).toBe(false);
  });
});

describe('MAX_DATA_URL_BYTES', () => {
  it('fits comfortably into the 10MB chrome.storage.local quota', () => {
    expect(MAX_DATA_URL_BYTES).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
});
