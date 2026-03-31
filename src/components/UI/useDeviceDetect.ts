"use client";

import { useEffect, useState } from "react";

export function useDeviceDetect() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsTouch(
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
      );
      setIsMobile(
        window.innerWidth < 768 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      );
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return { isMobile, isTouch };
}
