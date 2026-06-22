import { useEffect, useState } from "react";
import { apiGetBlob } from "../api/apiClient";

export function AuthenticatedImage({ path, alt = "", className = "" }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    async function loadImage() {
      setFailed(false);
      setSrc("");
      try {
        const blob = await apiGetBlob(path);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (active) setFailed(true);
      }
    }

    if (path) loadImage();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path || failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-100 text-xs text-slate-400`}>
        Không có ảnh
      </div>
    );
  }

  if (!src) {
    return <div className={`${className} animate-pulse bg-slate-100`} aria-label="Đang tải ảnh" />;
  }

  return <img src={src} alt={alt} loading="lazy" className={className} />;
}
