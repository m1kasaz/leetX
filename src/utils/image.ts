export const MAX_DATA_URL_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.85;

export function isAcceptedImage(file: File): boolean {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return true;
  if (file.type) return false;
  return /\.(jpe?g|png)$/i.test(file.name);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片无法解析'));
    img.src = src;
  });
}

// 压缩到最长边 1920px 的 JPEG，把单张背景控制在 chrome.storage.local 配额内。
export async function fileToDataUrl(file: File): Promise<string> {
  const img = await loadImage(await readFile(file));
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境不支持图片压缩');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  // base64 每 4 字符编码 3 字节
  if ((dataUrl.length * 3) / 4 > MAX_DATA_URL_BYTES) throw new Error('图片过大，请换一张更小的图片');
  return dataUrl;
}
