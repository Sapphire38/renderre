import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const CursorIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4l7 16 2-7 7-2z" />
  </svg>
);

export const WallIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 19L20 5" />
    <circle cx="4" cy="19" r="1.6" />
    <circle cx="20" cy="5" r="1.6" />
  </svg>
);

export const HandIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 13V5.5a1.5 1.5 0 013 0V12" />
    <path d="M11 12V4.5a1.5 1.5 0 013 0V12" />
    <path d="M14 12.5V6.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-1a6 6 0 01-5-2.7l-2-3a1.5 1.5 0 012.5-1.6L8 14" />
  </svg>
);

export const UndoIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 015 5 5 5 0 01-5 5H9" />
  </svg>
);

export const RedoIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9a5 5 0 00-5 5 5 5 0 005 5h6" />
  </svg>
);

export const RulerIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5l5.5-5.5 12.5 12.5-5.5 5.5z" />
    <path d="M7 7l2 2M10 4l2.5 2.5M13.5 7.5l2 2M16.5 10.5l2 2" />
  </svg>
);

export const CopyIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 012-2h8" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
    <path d="M6 6l1 14a1 1 0 001 1h8a1 1 0 001-1l1-14" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const GridIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

export const MagnetIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4v7a6 6 0 0012 0V4" />
    <path d="M6 9h4M14 9h4" />
  </svg>
);

export const FitIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SaveIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4h11l3 3v13a0 0 0 010 0H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </svg>
);

export const FolderIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7a1 1 0 011-1h5l2 2h9a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const DownloadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);

export const UploadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4 20h16" />
  </svg>
);

export const ChevronDownIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const CabinetIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <path d="M12 3v18M8 7h0.01M15 7h0.01M8 14h0.01M15 14h0.01" />
  </svg>
);

export const ExpandIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4H5a1 1 0 00-1 1v4M15 4h4a1 1 0 011 1v4M9 20H5a1 1 0 01-1-1v-4M15 20h4a1 1 0 001-1v-4" />
  </svg>
);

export const ShrinkIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5v4H5M15 5v4h4M9 19v-4H5M15 19v-4h4" />
  </svg>
);

export const FullscreenIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />
  </svg>
);

export const DoorIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 21V4a1 1 0 011-1h8a1 1 0 011 1v17" />
    <path d="M4 21h16" />
    <circle cx="13" cy="12" r="0.7" />
  </svg>
);

// Superficie de suelo: rombo (plano en perspectiva) con textura punteada.
export const SurfaceIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4l9 5-9 5-9-5z" />
    <path d="M3 9v3l9 5 9-5V9" />
    <circle cx="9" cy="9" r="0.4" />
    <circle cx="13" cy="11" r="0.4" />
    <circle cx="11" cy="7.5" r="0.4" />
  </svg>
);

// Cerco / alambrado: postes verticales con travesaños horizontales.
export const FenceIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4v16M12 4v16M18 4v16" />
    <path d="M3 9h18M3 15h18" />
  </svg>
);

export const CameraIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 9a1 1 0 011-1h2.2l1.3-2h6.8l1.3 2H20a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

export const SparklesIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
    <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
  </svg>
);
