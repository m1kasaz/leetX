import { useRef, useState } from 'react';
import type { GalleryImage } from '../../../src/db/gallery';

export function GalleryModal(props: {
  images: GalleryImage[];
  activeId: string | null;
  opacity: number;
  onClose(): void;
  onUpload(files: File[]): void;
  onSelect(id: string | null): void;
  onRemove(id: string): void;
  onOpacity(value: number): void;
}) {
  const { images, activeId, opacity, onClose, onUpload, onSelect, onRemove, onOpacity } = props;
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(event: React.DragEvent): File[] {
    event.preventDefault();
    event.stopPropagation();
    return Array.from(event.dataTransfer?.files ?? []);
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="gallery-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>背景图库</h2>
          <button type="button" aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <div
          className={`gallery-drop${dragOver ? ' drag-over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { pick(e); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            setDragOver(false);
            const files = pick(e);
            if (files.length) onUpload(files);
          }}
        >
          <b>点击选择或拖拽图片到这里</b>
          <span>支持 JPG / PNG，上传后自动压缩并设为当前背景</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onUpload(files);
            e.target.value = '';
          }}
        />
        <div className="gallery-grid">
          <button
            type="button"
            className={`gallery-item gallery-default${activeId === null ? ' active' : ''}`}
            onClick={() => onSelect(null)}
          >
            <span className="gallery-swatch" />
            <span className="gallery-name">默认背景</span>
          </button>
          {images.map((img) => (
            <div
              key={img.id}
              role="button"
              tabIndex={0}
              className={`gallery-item${img.id === activeId ? ' active' : ''}`}
              onClick={() => onSelect(img.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(img.id); }}
            >
              <img src={img.dataUrl} alt={img.name} />
              <span className="gallery-name">{img.name}</span>
              <button
                type="button"
                className="gallery-remove"
                aria-label={`删除 ${img.name}`}
                onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <label className="gallery-opacity">
          <span>面板透明度 <b>{opacity}%</b></span>
          <input
            type="range"
            min={15}
            max={90}
            step={1}
            value={opacity}
            onChange={(e) => onOpacity(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
