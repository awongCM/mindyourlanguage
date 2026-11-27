"use client";

import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

/** `null` until the client has measured — render nothing that depends on it. */
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}