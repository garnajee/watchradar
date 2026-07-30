import { useEffect, useState } from "react";
import { assetUrl } from "../lib/api";
import { initials } from "../lib/format";

export function Avatar({
  name,
  src,
  size = "md"
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = src ? assetUrl(src) : null;
  useEffect(() => setFailed(false), [src]);
  const sizeClass = {
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-20 w-20 text-xl"
  }[size];

  if (resolvedSrc && !failed) {
    return (
      <img
        className={`${sizeClass} shrink-0 rounded-2xl object-cover ring-1 ring-white/10`}
        src={resolvedSrc}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet to-cyan font-bold text-white shadow-glow`}
    >
      {initials(name)}
    </span>
  );
}
