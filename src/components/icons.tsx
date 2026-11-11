import type { SVGProps } from "react";

/** A small hand-drawn icon set. 20px grid, 1.5 stroke, used for function not decoration. */
const PATHS = {
  arrow: "M4 10h12M11 5l5 5-5 5",
  arrowUpRight: "M6 14 14 6M7 6h7v7",
  back: "M16 10H4M9 5l-5 5 5 5",
  close: "M5 5l10 10M15 5 5 15",
  menu: "M3 6.5h14M3 13.5h14",
  search: "M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12ZM13.5 13.5 17 17",
  filter: "M3 5.5h14M6 10h8M8.5 14.5h3",
  grid: "M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z",
  map: "M3 5.5 7.5 3.5l5 2 4.5-2v11l-4.5 2-5-2L3 16.5zM7.5 3.5v11M12.5 5.5v11",
  chat: "M3.5 4.5h13v9h-7l-3.5 3v-3h-2.5z",
  home: "M3.5 9 10 3.5 16.5 9v7.5h-13zM8 16.5v-4.5h4v4.5",
  people: "M7 9.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM2 16.5c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2M13 9.5a2.5 2.5 0 1 0-.8-4.9M14 12.4c2.3.3 4 1.8 4 4.1",
  user: "M10 10a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 10 10ZM3.5 17c0-3 2.9-5 6.5-5s6.5 2 6.5 5",
  check: "M4 10.5l4 4 8-9",
  shield: "M10 2.5 16 5v4.5c0 3.8-2.5 6.7-6 8-3.5-1.3-6-4.2-6-8V5z",
  flag: "M5 17.5V3.5M5 4h9.5l-2 3.25 2 3.25H5",
  block: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM5 5l10 10",
  send: "M3 10 17 3.5 13 17l-2.5-5.5z",
  plus: "M10 4v12M4 10h12",
  minus: "M4 10h12",
  chevronDown: "M5 7.5l5 5 5-5",
  chevronRight: "M7.5 5l5 5-5 5",
  chevronLeft: "M12.5 5l-5 5 5 5",
  calendar: "M3.5 5.5h13v11h-13zM3.5 9h13M7 3.5v3M13 3.5v3",
  pin: "M10 17.5s5.5-4.9 5.5-9a5.5 5.5 0 0 0-11 0c0 4.1 5.5 9 5.5 9ZM10 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  bed: "M2.5 15.5v-9M2.5 12.5h15v3M17.5 12.5V10a2 2 0 0 0-2-2H8.5v4.5M5.5 10.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  bath: "M3 10.5h14v2a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 3 12.5zM5.5 10.5V5a1.75 1.75 0 0 1 3.5 0M6 16l-.75 1.5M14 16l.75 1.5",
  sofa: "M4 9V6.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 16 6.5V9M2.5 10.5a1.5 1.5 0 0 1 3 0V12h9v-1.5a1.5 1.5 0 0 1 3 0V15h-15zM4.5 15v1.5M15.5 15v1.5",
  alert: "M10 3 18 16.5H2zM10 8v4M10 14.2v.3",
  info: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 9v4.5M10 6.5v.3",
  edit: "M4 16l.6-3.2L13.5 4l2.5 2.5-8.8 8.9zM12 5.5 14.5 8",
  trash: "M4 6h12M8 6V4h4v2M5.5 6l.7 10.5h7.6L14.5 6M8.5 9v5M11.5 9v5",
  pause: "M7 4.5v11M13 4.5v11",
  play: "M6 4l10 6-10 6z",
  refresh: "M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3h-3",
  camera: "M3 6.5h3L7.5 4.5h5L14 6.5h3v9.5H3zM10 13.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  logout: "M8 3.5H4v13h4M12.5 6.5 16 10l-3.5 3.5M16 10H8",
  dots: "M5 10h.01M10 10h.01M15 10h.01",
  lock: "M5 9h10v8H5zM7 9V6.5a3 3 0 0 1 6 0V9",
  sliders: "M4 6h7M15 6h1M4 14h1M9 14h7M13 4v4M7 12v4",
  offline: "M3 3l14 14M5.5 9.5A7 7 0 0 1 8 8M12.5 8.3a7 7 0 0 1 2.5 1.5M8 12.5a3.5 3.5 0 0 1 1.3-.6M10 15.5h.01",
  moon: "M15.5 12A6.5 6.5 0 0 1 8 4.5 6.5 6.5 0 1 0 15.5 12Z",
  key: "M12.5 10.5a3.5 3.5 0 1 0-3.2-2.1L3.5 14.2V16.5h2.3l.9-.9v-1.4h1.4l1.6-1.6a3.5 3.5 0 0 0 2.8-2.1ZM13 7h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
