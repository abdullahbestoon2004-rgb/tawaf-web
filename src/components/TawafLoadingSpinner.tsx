/**
 * Tawaf branded loading spinner.
 *
 * The logo is split across two aligned, transparent layers: the Kaaba stays
 * completely still while only the surrounding arcs and gold diamonds rotate
 * clockwise. Both layers share one square canvas so they line up exactly.
 */

const CENTER_SRC = "/assets/images/tawaf_loader_center.png";
const OUTER_SRC = "/assets/images/tawaf_loader_outer.png";

export default function TawafLoadingSpinner({
  size = 48,
  className = "",
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`tawaf-spinner ${className}`.trim()}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      <img className="tawaf-spinner-outer" src={OUTER_SRC} alt="" aria-hidden="true" draggable={false} />
      <img className="tawaf-spinner-center" src={CENTER_SRC} alt="" aria-hidden="true" draggable={false} />
    </span>
  );
}

/** Full-screen overlay on the Tawaf cream background. */
export function TawafLoadingOverlay({ size = 96, text }: { size?: number; text?: string }) {
  return (
    <div className="tawaf-spinner-overlay" role="status" aria-live="polite">
      <TawafLoadingSpinner size={size} />
      {text && <p>{text}</p>}
    </div>
  );
}
