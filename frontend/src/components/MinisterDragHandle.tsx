/** Grip control for reordering ministers (must be the draggable node so inputs do not capture drag). */
const MinisterDragHandle = ({
  onDragStart,
  onDragEnd,
  compact,
}: {
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  compact?: boolean;
}) => (
  <div
    role="button"
    tabIndex={0}
    draggable
    aria-label="Drag to reorder ministers"
    title="Drag to reorder"
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    className={`shrink-0 cursor-grab touch-none select-none rounded-md border border-transparent text-[hsl(0,0%,55%)] outline-none transition-colors hover:border-[hsl(0,0%,85%)] hover:bg-white/80 active:cursor-grabbing ${
      compact ? "p-0.5" : "p-1"
    }`}
  >
    <svg
      width={compact ? 14 : 16}
      height={compact ? 18 : 20}
      viewBox="0 0 16 20"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="11" cy="10" r="1.5" />
      <circle cx="5" cy="16" r="1.5" />
      <circle cx="11" cy="16" r="1.5" />
    </svg>
  </div>
);

export default MinisterDragHandle;
