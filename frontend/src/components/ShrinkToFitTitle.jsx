import { useLayoutEffect, useRef } from "react";

// Renders a fixed-height (lineHeight * lines), fixed-width title that shrinks its
// own font-size (instead of clamping/truncating with "…") until the full text fits.
// Keeps every card in a grid the same height regardless of title length.
export default function ShrinkToFitTitle({
  text,
  className = "",
  as: Tag = "h3",
  lines = 2,
  baseSize = 18,
  minSize = 12,
  lineHeight = 24,
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const maxHeight = lineHeight * lines + 1; // +1px rounding tolerance
    let size = baseSize;
    el.style.fontSize = `${size}px`;
    while (el.scrollHeight > maxHeight && size > minSize) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, [text, lines, baseSize, minSize, lineHeight]);

  return (
    <Tag
      ref={ref}
      className={className}
      style={{ lineHeight: `${lineHeight}px`, height: `${lineHeight * lines}px`, overflow: "hidden", overflowWrap: "break-word" }}
    >
      {text}
    </Tag>
  );
}
