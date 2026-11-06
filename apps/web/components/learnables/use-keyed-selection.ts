"use client";

import { useEffect, useState } from "react";

/** Multi-select by stable string keys; resets when the key list changes. */
export function useKeyedSelection(keys: string[]) {
  const signature = keys.join("\0");
  const [selected, setSelected] = useState(() => new Set(keys));

  useEffect(() => {
    setSelected(new Set(keys));
    // signature tracks the same membership as keys without depending on array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys captured via signature
  }, [signature]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectedItems<T>(items: T[], keyOf: (item: T) => string): T[] {
    return items.filter((item) => selected.has(keyOf(item)));
  }

  return {
    has: (key: string) => selected.has(key),
    toggle,
    selectedItems,
  };
}
