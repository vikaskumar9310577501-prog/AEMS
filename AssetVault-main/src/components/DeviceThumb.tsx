import { useEffect, useState } from 'react';
import { getDevicePreviewFallbackUrl, getAssetPreviewUrl } from '../lib/devicePreview';
import { getDeviceImageUrl } from '../lib/fileUrls';
import { cn } from '../lib/utils';

interface DeviceThumbProps {
  assetType: string;
  mainCategory?: string;
  subCategory?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-14 h-14',
  md: 'w-16 h-16',
  lg: 'w-32 h-32',
};

type PreviewImages = {
  subCategoryImages?: Record<string, string>;
  softwareSubCategoryImages?: Record<string, string>;
};

let previewCache: PreviewImages | null = null;
let previewPromise: Promise<PreviewImages | null> | null = null;

async function loadPreviewImages(): Promise<PreviewImages | null> {
  if (previewCache) return previewCache;
  if (previewPromise) return previewPromise;

  previewPromise = fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/settings')
    .then((res) => res.json())
    .then((data) => {
      const catalog = data?.catalog || {};
      previewCache = {
        subCategoryImages: catalog.subCategoryImages || {},
        softwareSubCategoryImages: catalog.softwareSubCategoryImages || {},
      };
      return previewCache;
    })
    .catch(() => {
      previewCache = { subCategoryImages: {}, softwareSubCategoryImages: {} };
      return previewCache;
    });

  return previewPromise;
}

export default function DeviceThumb({ assetType, mainCategory, subCategory, imageUrl, size = 'md', className }: DeviceThumbProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImages | null>(previewCache);

  useEffect(() => {
    if (previewCache) return;
    loadPreviewImages().then((data) => {
      if (data) setPreviewImages(data);
    });
  }, []);

  const src = imageUrl
    ? getDeviceImageUrl(imageUrl)
    : getAssetPreviewUrl(
        mainCategory || "IT Assets",
        subCategory || "",
        assetType,
        previewImages?.subCategoryImages,
        previewImages?.softwareSubCategoryImages
      );
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-sm',
        'flex items-center justify-center p-1.5',
        sizeMap[size],
        className
      )}
    >
      <img
        src={src}
        alt={assetType}
        className="max-w-full max-h-full w-auto h-auto object-contain object-center"
        loading="lazy"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          const fallback = mainCategory && mainCategory !== "IT Assets"
            ? "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85"
            : getDevicePreviewFallbackUrl(assetType);
          if (img.src !== fallback) img.src = fallback;
        }}
      />
    </div>
  );
}
