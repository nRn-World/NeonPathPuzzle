import type { SVGProps } from "react";

/**
 * The game's icon set. Every glyph uses a symbol people already know (stopwatch,
 * back arrow, circular arrow, light bulb, bolt, trophy, question mark, gear), so
 * its meaning is clear at a glance, drawn in one duotone style: a 1.9px rounded
 * stroke over a soft tinted fill, on a 24px grid.
 */
const SOFT = 0.18;

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

const soft = { fill: "currentColor", fillOpacity: SOFT } as const;

/** Stopwatch: how long this run has taken. */
export const TimerIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="13.5" r="7.5" {...soft} />
    <path d="M12 9.5V13.8L14.8 15.5" />
    <path d="M9.5 2.8H14.5" />
    <path d="M12 2.8V6" />
    <path d="M18.4 7.4L19.8 6" />
  </Icon>
);

/** Curved arrow pointing back: undo the last step. */
export const UndoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5L4.5 9.5L9 14" />
    <path d="M4.5 9.5H14.5A5 5 0 0 1 14.5 19.5H9" />
  </Icon>
);

/** Circular arrow: start the level over. */
export const RestartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12A8 8 0 1 1 17.6 6.3" />
    <path d="M20.2 3.6V8.2H15.6" />
  </Icon>
);

/** Light bulb: show a hint. */
export const HintIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 2.8A6.2 6.2 0 0 0 8.2 14C8.9 14.6 9.2 15.2 9.2 16V16.6H14.8V16C14.8 15.2 15.1 14.6 15.8 14A6.2 6.2 0 0 0 12 2.8Z" {...soft} />
    <path d="M9.6 19.4H14.4" />
    <path d="M10.6 22H13.4" />
  </Icon>
);

/** Lightning bolt: power-ups. */
export const PowerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13.2 2.6L5 13.4H11L10.2 21.4L19 10.2H13Z" {...soft} />
  </Icon>
);

/** Trophy: achievements. */
export const TrophyIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7.2 3.8H16.8V9.2A4.8 4.8 0 0 1 7.2 9.2Z" {...soft} />
    <path d="M7.2 5.8H4.2V8A3.2 3.2 0 0 0 7.4 11.2" />
    <path d="M16.8 5.8H19.8V8A3.2 3.2 0 0 1 16.6 11.2" />
    <path d="M12 14V17.6" />
    <path d="M8.6 20.6H15.4" />
    <path d="M9.8 17.6H14.2V20.6H9.8Z" {...soft} />
  </Icon>
);

/** Question mark in a circle: help and shortcuts. */
export const HelpIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" {...soft} />
    <path d="M9.4 9.6A2.7 2.7 0 1 1 13.2 12C12.5 12.4 12 13 12 13.8V14" />
    <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
  </Icon>
);

/** Gear with eight teeth: settings. */
function gearPath(teeth: number, outer: number, inner: number) {
  const step = (Math.PI * 2) / teeth;
  const point = (radius: number, angle: number) =>
    `${(12 + Math.cos(angle) * radius).toFixed(2)} ${(12 + Math.sin(angle) * radius).toFixed(2)}`;
  const parts: string[] = [];
  for (let tooth = 0; tooth < teeth; tooth++) {
    const middle = tooth * step - Math.PI / 2;
    const half = step * 0.5;
    const points = [
      point(inner, middle - half * 0.95),
      point(outer, middle - half * 0.42),
      point(outer, middle + half * 0.42),
      point(inner, middle + half * 0.95),
    ];
    parts.push(`${tooth === 0 ? "M" : "L"}${points[0]}L${points[1]}L${points[2]}L${points[3]}`);
  }
  return `${parts.join("")}Z`;
}

const GEAR = gearPath(8, 9.6, 7.3);

export const GearIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d={GEAR} {...soft} />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const BackIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12H4.5" />
    <path d="M10.5 6L4.5 12L10.5 18" />
  </Icon>
);

/** Five-point star, filled when earned. */
export const StarIcon = ({ filled, ...props }: IconProps & { filled?: boolean }) => (
  <Icon {...props} fill={filled ? "currentColor" : "none"}>
    <path d="M12 3L14.7 8.9L21 9.6L16.3 13.9L17.6 20.2L12 17L6.4 20.2L7.7 13.9L3 9.6L9.3 8.9Z" />
  </Icon>
);
