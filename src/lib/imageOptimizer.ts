/**
 * Lightweight client-side image optimizer.
 * Resizes large images (e.g. 4K screenshots) to a sensible max dimension
 * and encodes as WebP/JPEG before uploading to PostgreSQL so uploads and
 * storefront rendering remain fast and lag-free.
 */
export async function optimizeImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<string> {
  // Keep SVGs and GIFs untouched as raw Data URIs
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return readFileAsDataUri(file);
  }

  try {
    const rawDataUri = await readFileAsDataUri(file);
    const img = await loadImage(rawDataUri);

    let { width, height } = img;
    if (width <= maxDimension && height <= maxDimension && file.size <= 350 * 1024) {
      return rawDataUri;
    }

    if (width > height && width > maxDimension) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else if (height >= width && height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUri;

    ctx.drawImage(img, 0, 0, width, height);

    const outputMime = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
    const compressed = canvas.toDataURL(outputMime, quality);
    return compressed.length < rawDataUri.length ? compressed : rawDataUri;
  } catch {
    return readFileAsDataUri(file);
  }
}

export async function compressAndOptimizeImage(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<{ dataUrl: string; mimeType: string }> {
  const dataUrl = await optimizeImageFile(file, maxDimension, quality);
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return {
    dataUrl,
    mimeType: match ? match[1] : file.type || 'image/webp',
  };
}

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}
