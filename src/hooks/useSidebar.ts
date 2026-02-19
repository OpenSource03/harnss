import { useState, useCallback } from "react";

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem("sidebar-open") !== "false";
  });

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-open", String(next));
      return next;
    });
  }, []);

  return { isOpen, toggle, setIsOpen };
}
