import { useEffect } from "react";

function useClickOutside(ref, onOutside, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointer = (event) => {
      const element = ref?.current;
      if (!element || element.contains(event.target)) return;
      onOutside?.(event);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onOutside?.(event);
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onOutside, ref]);
}

export default useClickOutside;
