import type { ReactElement, ReactNode } from "react";

type Props = { className?: string };

function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <svg className={className ?? "hud-ico"} viewBox="0 0 24 24" aria-hidden>
      {children}
    </svg>
  );
}

export function HudIconHome({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-5.5H10.2V21H5a1 1 0 0 1-1-1v-9.5Z" />
    </Svg>
  );
}

export function HudIconSun({ className }: Props) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
    </Svg>
  );
}

export function HudIconLayers({ className }: Props) {
  return (
    <Svg className={className}>
      <path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" />
      <path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5" />
    </Svg>
  );
}

export function HudIconGear({ className }: Props) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M10.2 3.8h3.6l.5 2.1 2-.8 2.5 2.5-.8 2 2.1.5v3.6l-2.1.5.8 2-2.5 2.5-2-.8-.5 2.1h-3.6l-.5-2.1-2 .8-2.5-2.5.8-2L3.8 13.8v-3.6l2.1-.5-.8-2 2.5-2.5 2 .8.5-2.1Z" />
    </Svg>
  );
}
