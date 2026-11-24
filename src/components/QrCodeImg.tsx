import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeImgProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

export const QrCodeImg: React.FC<QrCodeImgProps> = ({
  value,
  size = 200,
  className = '',
  alt = 'QR Code',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: {
        dark: '#0B0F17',
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
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-white/10 animate-pulse rounded-lg ${className}`}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      className={`rounded-lg bg-white p-1.5 ${className}`}
    />
  );
};
