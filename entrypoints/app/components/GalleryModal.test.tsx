import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { GalleryImage } from '../../../src/db/gallery';
import { GalleryModal } from './GalleryModal';

const images: GalleryImage[] = [
  { id: 'a', name: 'a.png', dataUrl: 'data:image/jpeg;base64,a', createdAt: 1 },
  { id: 'b', name: 'b.jpg', dataUrl: 'data:image/jpeg;base64,b', createdAt: 2 },
];

function render(props: Partial<Parameters<typeof GalleryModal>[0]>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(
      <GalleryModal
        images={images}
        activeId={null}
        opacity={55}
        onClose={() => {}}
        onUpload={() => {}}
        onSelect={() => {}}
        onRemove={() => {}}
        onOpacity={() => {}}
        {...props}
      />,
    );
  });
  return host;
}

function drop(host: HTMLElement, files: File[]) {
  const zone = host.querySelector('.gallery-drop')!;
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  act(() => {
    zone.dispatchEvent(event);
  });
}

describe('GalleryModal', () => {
  it('renders the default entry plus one thumbnail per image', () => {
    const host = render({});
    expect(host.querySelectorAll('.gallery-item')).toHaveLength(3);
    expect(host.querySelector('.gallery-item img')?.getAttribute('src')).toBe(images[0].dataUrl);
  });

  it('marks the active image and the default entry when nothing is active', () => {
    const host = render({ activeId: 'b' });
    const items = host.querySelectorAll('.gallery-item');
    expect(items[0].className).not.toContain('active');
    expect(items[2].className).toContain('active');
    expect(render({}).querySelector('.gallery-item')?.className).toContain('active');
  });

  it('selects an image by clicking its thumbnail', () => {
    const onSelect = vi.fn();
    const host = render({ onSelect });
    act(() => {
      host.querySelectorAll<HTMLElement>('.gallery-item')[1].click();
    });
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('restores the default background from the first entry', () => {
    const onSelect = vi.fn();
    const host = render({ activeId: 'a', onSelect });
    act(() => {
      host.querySelectorAll<HTMLElement>('.gallery-item')[0].click();
    });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('removes an image without selecting it', () => {
    const onRemove = vi.fn();
    const onSelect = vi.fn();
    const host = render({ onRemove, onSelect });
    act(() => {
      host.querySelectorAll<HTMLElement>('.gallery-item')[1].querySelector<HTMLElement>('.gallery-remove')!.click();
    });
    expect(onRemove).toHaveBeenCalledWith('a');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('passes dropped files to the upload handler', () => {
    const onUpload = vi.fn();
    const host = render({ onUpload });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    drop(host, [file]);
    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it('ignores drops without files', () => {
    const onUpload = vi.fn();
    const host = render({ onUpload });
    drop(host, []);
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('highlights the drop zone while dragging over it', () => {
    const host = render({});
    const zone = host.querySelector('.gallery-drop')!;
    const over = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(over, 'dataTransfer', { value: { files: [] } });
    act(() => {
      zone.dispatchEvent(over);
    });
    expect(zone.className).toContain('drag-over');
  });

  it('shows the current opacity and reports slider changes', () => {
    const onOpacity = vi.fn();
    const host = render({ opacity: 40, onOpacity });
    const slider = host.querySelector<HTMLInputElement>('.gallery-opacity input[type="range"]')!;
    expect(slider.value).toBe('40');
    expect(host.querySelector('.gallery-opacity')?.textContent).toContain('40%');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(slider, '70');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onOpacity).toHaveBeenCalledWith(70);
  });
});
