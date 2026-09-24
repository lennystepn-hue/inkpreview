/** SVG filter that turns a black-on-white design into a purple thermal-stencil
 *  transfer: color = stencil ink, alpha = darkness (white → transparent).
 *  Used via the `.stencil-ghost` class. Mount once per page. */
export function StencilDefs() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      className="pointer-events-none absolute"
    >
      <filter id="ink-stencil" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.29  0 0 0 0 0.184  0 0 0 0 0.698  -0.2126 -0.7152 -0.0722 1 0"
        />
        <feComponentTransfer>
          <feFuncA type="linear" slope="1.5" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
