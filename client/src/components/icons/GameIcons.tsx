import type { SVGProps } from "react";

/**
 * The game's own icon set. Every glyph is drawn on a 24px grid with the same
 * 1.8px stroke, square caps and mitred joins, and most of them are built from
 * the game's two ingredients: nodes (rings) and right-angled lines.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

/** A ring with a hand that turns a right angle, like the line does. */
export const TimerIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="13" r="8" strokeLinecap="butt" />
    <path d="M12 8.5V13H16" />
    <path d="M9.5 2.5H14.5" />
  </Icon>
);

/** An orthogonal path that doubles back on itself. */
export const UndoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.5 4.5L5 9L9.5 13.5" />
    <path d="M5 9H15.5A4.5 4.5 0 0 1 15.5 18H9" />
  </Icon>
);

/** A node in the centre of a circular arrow. */
export const RestartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12A8 8 0 1 1 17.7 6.3" strokeLinecap="butt" />
    <path d="M18 2.5V7H13.5" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
  </Icon>
);

/** Two nodes joined by the revealed path. */
export const HintIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="6" cy="18" r="2.4" strokeLinecap="butt" />
    <circle cx="18" cy="6" r="2.4" strokeLinecap="butt" />
    <path d="M6 15.6V10.5H18V8.4" strokeDasharray="2.6 2.4" strokeLinecap="butt" />
  </Icon>
);

/** An angular bolt rather than the stock rounded one. */
export const PowerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13.5 2.5L5 13.5H11L10 21.5L19 10H13Z" />
  </Icon>
);

/** A hexagonal badge with a four-point spark. */
export const BadgeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 2.5L20.5 7.25V16.75L12 21.5L3.5 16.75V7.25Z" />
    <path d="M12 7.5L13.4 10.6L16.5 12L13.4 13.4L12 16.5L10.6 13.4L7.5 12L10.6 10.6Z" fill="currentColor" stroke="none" />
  </Icon>
);

/** A keycap, for the keyboard shortcuts. */
export const KeysIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="5.5" width="19" height="13" strokeLinecap="butt" />
    <path d="M6.5 9.5H7.5M10.5 9.5H11.5M14.5 9.5H15.5M18 9.5H18.5" strokeLinecap="butt" />
    <path d="M7 14.5H17" />
  </Icon>
);

/** Two sliders: settings without the stock gear. */
export const SlidersIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 7H11M17 7H21" />
    <rect x="11" y="4.5" width="6" height="5" fill="currentColor" stroke="none" />
    <path d="M3 17H7M13 17H21" />
    <rect x="7" y="14.5" width="6" height="5" fill="currentColor" stroke="none" />
  </Icon>
);

export const BackIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12H4.5" />
    <path d="M10.5 6L4.5 12L10.5 18" />
  </Icon>
);

/** A sharp five-point star, filled when earned. */
export const StarIcon = ({ filled, ...props }: IconProps & { filled?: boolean }) => (
  <Icon {...props} fill={filled ? "currentColor" : "none"}>
    <path d="M12 2.8L14.7 9L21.4 9.6L16.3 14L17.9 20.6L12 17.1L6.1 20.6L7.7 14L2.6 9.6L9.3 9Z" />
  </Icon>
);
