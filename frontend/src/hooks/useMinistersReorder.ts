import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { MinisterLocalRow } from "@/contexts/CreateDesignContext";

type SetMinisters = Dispatch<SetStateAction<MinisterLocalRow[]>>;

/**
 * HTML5 drag-and-drop reorder for minister rows (order = prominence on flyer).
 * Use a dedicated drag handle so text inputs do not start drags.
 */
export function useMinistersReorder(setMinisters: SetMinisters) {
  const fromRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const clear = useCallback(() => {
    fromRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
  }, []);

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    fromRef.current = index;
    setDraggingIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    clear();
  }, [clear]);

  const rowDragHandlers = useCallback(
    (index: number) => ({
      onDragOver: (e: React.DragEvent) => {
        if (fromRef.current === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOverIndex(index);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const from = fromRef.current;
        clear();
        if (from === null || from === index) return;
        setMinisters((prev) => {
          const next = [...prev];
          const [row] = next.splice(from, 1);
          next.splice(index, 0, row);
          return next;
        });
      },
    }),
    [clear, setMinisters]
  );

  const rowVisualClass = useCallback(
    (index: number) => {
      if (draggingIndex === null) return "";
      if (draggingIndex === index) return "opacity-60";
      if (overIndex === index && draggingIndex !== index) {
        return "ring-2 ring-[hsl(330,100%,45%)] ring-offset-2 ring-offset-[hsl(0,0%,97%)] rounded-xl";
      }
      return "";
    },
    [draggingIndex, overIndex]
  );

  return { handleDragStart, handleDragEnd, rowDragHandlers, rowVisualClass };
}
