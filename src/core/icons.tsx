import type { ReactNode } from 'react';

/** Minimal inline-SVG icon set (no icon-library dependency). Stroke inherits `currentColor`. */
function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconWrench = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18v3h3l6.4-6.3a4 4 0 0 0 5.3-5.4l-2.5 2.5-2.1-2.1z" />
  </Svg>
);
export const IconBug = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="8" y="6" width="8" height="14" rx="4" />
    <path d="M9 6a3 3 0 0 1 6 0M3 13h5M16 13h5M4 18l4-2M20 18l-4-2M4 8l4 2M20 8l-4 2" />
  </Svg>
);
export const IconGauge = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 14l3-3" />
    <path d="M3.5 18a9 9 0 1 1 17 0" />
  </Svg>
);
export const IconGraph = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <path d="M10 6.5h4a3 3 0 0 1 3 3V14" />
  </Svg>
);
export const IconX = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconChevronRight = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const IconChevronDown = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconSearch = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </Svg>
);
export const IconCopy = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
);
export const IconFileCode = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M10 12l-2 2 2 2M14 12l2 2-2 2" />
  </Svg>
);
export const IconRefresh = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </Svg>
);
export const IconPointer = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 3l16 7-7 2-2 7z" />
  </Svg>
);
export const IconLayers = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />
  </Svg>
);
export const IconArrowUp = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);
