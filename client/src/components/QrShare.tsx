import { useEffect, useState } from "react";
import { qrDataUrl } from "@/lib/qr";

/**
 * QR sharing for the ghost challenge: another device can scan the exact board,
 * line and time straight from the screen. The code is generated locally and
 * never leaves the device.
 */
export function QrShare({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    void qrDataUrl(url)
      .then(data => { if (alive) setSrc(data); })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [url]);

  if (!src) return null;
  return (
    <div className="flex items-center gap-3 border border-white/10 bg-white/[0.02] p-2">
      <img src={src} alt={label} width={88} height={88} className="h-[88px] w-[88px] bg-white p-1" />
      <p className="font-exo text-xs leading-relaxed text-muted-foreground">{label}</p>
    </div>
  );
}
