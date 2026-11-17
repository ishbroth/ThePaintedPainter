/**
 * The placeholder for a business with no picture yet: a paintbrush silhouette, standing in for the head-and-shoulders silhouette a person gets.
 * It is the same house painter's brush as the pins on the painters map (wide flat brush, short handle, metal ferrule, thick bristles with a
 * drop of paint at the tip), drawn in one flat color with thin gaps between its parts, and in the pins' orientation (bristles up, handle down).
 * Colors come from the theme, so it works in light and dark.
 */
export default function PaintbrushSilhouette({
  className = 'w-full h-full',
  background = true,
}: {
  className?: string;
  /** A filled square behind the brush (an avatar); off for a brush sitting on a picture area that already has its own background. */
  background?: boolean;
}) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="No picture yet" preserveAspectRatio="xMidYMid meet">
      {background && <rect width="64" height="64" fill="var(--bg-chrome)" />}
      {/* the pin's brush (38 x 54), flipped so the bristles are on top, and centred in the square */}
      <g transform="translate(13 59) scale(1 -1)" fill="var(--text-faint)" stroke="var(--bg-chrome)" strokeWidth="1.4" strokeLinejoin="round">
        {/* the handle */}
        <path d="M15 3Q19 0 23 3L24 15H14Z" />
        {/* the ferrule */}
        <rect x="9" y="15" width="20" height="11" rx="1.5" />
        {/* the bristles */}
        <path d="M9 26H29L30 43Q19 48 8 43Z" />
      </g>
      {/* the drop of paint at the tip: a small teardrop above the bristles (no outline, so it stays a solid drop) */}
      <path d="M32 3.2Q27.6 8.2 28.4 10.2A3.6 3.6 0 0 0 35.6 10.2Q36.4 8.2 32 3.2Z" fill="var(--text-faint)" />
    </svg>
  );
}
