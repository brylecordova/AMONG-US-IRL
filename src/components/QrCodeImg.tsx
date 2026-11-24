import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeImgProps {
  value: string;
  size?: number;
  renderSize?: number;
  responsive?: boolean;
  className?: string;
  alt?: string;
  darkColor?: string;
}

export const QrCodeImg: React.FC<QrCodeImgProps> = ({
  value,
  size = 200,
  renderSize,
  responsive = false,
  className = '',
  alt = 'QR Code',
  darkColor = '#0B0F17',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const pixelWidth = renderSize ?? size;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: pixelWidth,
      margin: 2,
      color: {
        dark: darkColor,
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [value, pixelWidth, darkColor]);

  if (!dataUrl) {
    return (
      <div
        style={responsive ? undefined : { width: size, height: size }}
        className={`bg-white/10 animate-pulse rounded-lg ${responsive ? 'w-full h-full' : ''} ${className}`}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={responsive ? undefined : size}
      height={responsive ? undefined : size}
      alt={alt}
      className={`rounded-lg bg-white p-1.5 ${responsive ? 'w-full h-full object-contain' : ''} ${className}`}
    />
  );
};
