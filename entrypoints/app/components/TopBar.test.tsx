import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { TopBar } from './TopBar';

function render(onOpenGallery: () => void) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(
      <TopBar
        theme="system"
        captureCount={0}
        onCycleTheme={() => {}}
        onOpenSettings={() => {}}
        onOpenGallery={onOpenGallery}
      />,
    );
  });
  return host;
}

describe('TopBar', () => {
  it('opens the gallery from the top-actions button', () => {
    const onOpenGallery = vi.fn();
    const host = render(onOpenGallery);
    const button = host.querySelector<HTMLButtonElement>('.top-actions button[aria-label="图库"]');
    expect(button).toBeTruthy();
    act(() => button!.click());
    expect(onOpenGallery).toHaveBeenCalled();
  });
});
