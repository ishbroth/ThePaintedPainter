/** Faint, fixed full-page house watermarks that sit behind all page content
 * but above the flat theme background color. Stays put on scroll (position:
 * fixed) — one house leans off-center right, fading in left-to-right; a
 * second leans off-center left, mirroring it by fading in right-to-left.
 * Both use mask gradients so neither ever competes with text. */
const HouseWatermark = () => {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Right house — fades in from left (transparent) to right (visible) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          maskImage: 'linear-gradient(to right, transparent 0%, transparent 15%, black 70%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, transparent 15%, black 70%)',
        }}
      >
        <img
          src="/thumbnail_IMG_3199.jpg"
          alt=""
          style={{
            height: '105%',
            width: 'auto',
            maxWidth: 'none',
            objectFit: 'cover',
            filter: 'grayscale(1)',
            opacity: 'var(--watermark-opacity)',
            transform: 'translateX(8%)',
          }}
        />
      </div>

      {/* Left house — mirrors the right one, fading in from right (transparent) to left (visible) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          maskImage: 'linear-gradient(to left, transparent 0%, transparent 15%, black 70%)',
          WebkitMaskImage: 'linear-gradient(to left, transparent 0%, transparent 15%, black 70%)',
        }}
      >
        <img
          src="/thumbnail_IMG_2303.jpg"
          alt=""
          style={{
            height: '105%',
            width: 'auto',
            maxWidth: 'none',
            objectFit: 'cover',
            filter: 'grayscale(1)',
            opacity: 'var(--watermark-opacity)',
            transform: 'translateX(-8%)',
          }}
        />
      </div>
    </div>
  );
};

export default HouseWatermark;
