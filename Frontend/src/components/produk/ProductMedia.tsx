import { useState } from 'react';
import { Package } from 'lucide-react';
import { isProductVideo } from '../../lib/products';

export default function ProductMedia({
  src,
  alt = '',
  className,
  loading,
  controls = false,
  video = false
}: {
  src: string;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  controls?: boolean;
  video?: boolean;
}) {
  const [failedSource, setFailedSource] = useState('');
  if (failedSource === src) return <Package className="text-gray-300 m-auto" aria-label="Media tidak tersedia" />;
  if (video || isProductVideo(src)) {
    const videoUrl = new URL(src, window.location.href);
    videoUrl.searchParams.delete('thumb');
    return <video src={videoUrl.href} controls={controls} muted={!controls} playsInline preload="metadata" className={className} onError={() => setFailedSource(src)} />;
  }
  return <img src={src} alt={alt} loading={loading} className={className} onError={() => setFailedSource(src)} />;
}
