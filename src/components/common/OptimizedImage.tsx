import React from 'react';
import { resolveCdnAsset } from '../../services/performanceEngine';

interface OptimizedImageProps {
  baseName: 'hero-iot-stage' | 'module-esp32-node' | 'module-sensors-dht22' | 'module-mqtt-broker' | 'module-ai-anomaly' | 'module-lab-bioterium' | 'module-climate-chamber' | 'simoa-logo';
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

/**
 * Componente de Imagen Optimizada de Próxima Generación:
 * - Sirve AVIF y WebP desde CDN / caché inmutable mediante <picture>
 * - Aplica lazy loading nativo (loading="lazy" decoding="async") en imágenes fuera de pantalla
 * - Aplica fetchPriority="high" y loading="eager" en el Hero principal (LCP)
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  baseName,
  alt,
  className = 'w-full h-full object-cover',
  priority = false,
  width = 900,
  height = 600,
}) => {
  const avifUrl = resolveCdnAsset(`/assets/images/${baseName}.avif`);
  const webpUrl = resolveCdnAsset(`/assets/images/${baseName}.webp`);

  return (
    <picture className="block w-full h-full">
      <source srcSet={avifUrl} type="image/avif" />
      <source srcSet={webpUrl} type="image/webp" />
      <img
        src={webpUrl}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'low'}
        className={className}
      />
    </picture>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

