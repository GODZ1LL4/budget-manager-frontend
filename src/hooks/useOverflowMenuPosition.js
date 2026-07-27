import { useEffect, useState } from "react";

function useOverflowMenuPosition(ref, isOpen, gap = 8) {
  const [placement, setPlacement] = useState("down");

  useEffect(() => {
    if (!isOpen || !ref?.current) return;

    const updatePlacement = () => {
      const root = ref.current;
      const trigger = root.querySelector("[data-overflow-trigger='true']");
      const menu = root.querySelector("[data-overflow-menu='true']");

      if (!trigger || !menu) return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const safeBottom = 16;
      const spaceBelow = viewportHeight - triggerRect.bottom - safeBottom;
      const spaceAbove = triggerRect.top - safeBottom;

      if (spaceBelow < menuRect.height + gap && spaceAbove > spaceBelow) {
        setPlacement("up");
        return;
      }

      setPlacement("down");
    };

    const rafId = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [gap, isOpen, ref]);

  return placement;
}

export default useOverflowMenuPosition;
