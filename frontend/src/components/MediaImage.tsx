import { Film } from "lucide-react";
import { useEffect, useState } from "react";
import { assetUrl } from "../lib/api";

export function MediaImage({
  src,
  alt,
  className = ""
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = src ? assetUrl(src) : null;
  useEffect(() => setFailed(false), [src]);
  if (!resolvedSrc || failed) {
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br from-slate-800 to-violet/20 text-muted ${className}`}
        role="img"
        aria-label={alt}
      >
        <Film aria-hidden="true" className="h-8 w-8" />
      </div>
    );
  }
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`object-cover ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
