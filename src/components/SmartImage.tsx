import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  fallbackTitle?: string;
  fallbackEmoji?: string;
  className?: string;
  imgClassName?: string;
}

export async function compressImageToDataUri(
  file: File,
  maxDimension = 1280,
  quality = 0.84
): Promise<string> {
  // Keep SVGs and GIFs untouched
  if (file.type === 'image/svg+xml' || file.type === 'image/gif' || file.size < 120 * 1024) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
      const dataUri = canvas.toDataURL(outputType, quality);
      resolve(dataUri);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

export const SmartImage: React.FC<SmartImageProps> = React.memo(
  ({
    src,
    alt,
    fallbackTitle,
    fallbackEmoji,
    className = '',
    imgClassName = 'w-full h-full object-cover',
  }) => {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      setFailed(false);
    }, [src]);

    const cleanSrc = src ? src.trim() : '';

    if (!cleanSrc || failed) {
      return (
        <div
          className={`relative flex flex-col items-center justify-center bg-gradient-to-br from-[#140B0E] via-[#1A0E12] to-[#090708] border border-[#2C1A1E] text-center p-4 overflow-hidden select-none ${className}`}
        >
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-2">
            {fallbackEmoji ? (
              <span className="text-2xl">{fallbackEmoji}</span>
            ) : (
              <Shield className="w-6 h-6 text-red-400" />
            )}
          </div>
          {fallbackTitle && (
            <span className="text-xs font-medium text-stone-300 line-clamp-1 max-w-[90%]">
              {fallbackTitle}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className={`relative overflow-hidden bg-[#120C0E] ${className}`}>
        <img
          src={cleanSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={imgClassName}
        />
      </div>
    );
  }
);
