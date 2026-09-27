"use client";

import { useEffect } from "react";

const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

export default function InteractiveFormEnhancer() {
  useEffect(() => {
    function openNativePicker(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !PICKER_TYPES.has(target.type)) return;
      if (target.disabled || target.readOnly) return;
      try { target.showPicker?.(); } catch {}
    }

    document.addEventListener("click", openNativePicker);
    return () => document.removeEventListener("click", openNativePicker);
  }, []);

  return null;
}
