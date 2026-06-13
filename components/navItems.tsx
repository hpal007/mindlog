import type { ReactElement, SVGProps } from "react";

/**
 * Single source of truth for the three MindLog sections. Shared by the desktop
 * SideNav (ARIA tablist) and the mobile drawer so labels, copy, icons, and the
 * panel ids never drift apart.
 */
export type NavId = "journal" | "companion" | "trends";

export type NavItem = {
  id: NavId;
  /** Short label in the rail / drawer. */
  label: string;
  /** Per-panel heading shown in the content area. */
  title: string;
  /** Per-panel supporting line. */
  subtitle: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
};

// Minimal, calm line icons — decorative, so callers pass aria-hidden.
function JournalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5Z" />
      <path d="M5 17.5A1.5 1.5 0 0 1 6.5 16H19" />
      <path d="M9 7.5h6M9 11h4" />
    </svg>
  );
}

function CompanionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5v-3.5h-.5A2.5 2.5 0 0 1 4 13.5Z" />
      <path d="M8.5 9.5h7M8.5 12.5h4" />
    </svg>
  );
}

function TrendsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <path d="M7.5 14.5 11 10l3 2.5 4-5.5" />
    </svg>
  );
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "journal",
    label: "Journal",
    title: "How are you, really?",
    subtitle:
      "A private space to put exam-season pressure into words — and to notice what is quietly building underneath.",
    Icon: JournalIcon,
  },
  {
    id: "companion",
    label: "Companion",
    title: "Talk it through",
    subtitle:
      "A gentle, always-available companion — grounded in what your recent entries have been telling you.",
    Icon: CompanionIcon,
  },
  {
    id: "trends",
    label: "Trends",
    title: "Your patterns",
    subtitle:
      "How your mood has moved, what comes up most, and the patterns a plain tracker would miss.",
    Icon: TrendsIcon,
  },
] as const;

/** Stable panel element id for a section (referenced by aria-controls). */
export const panelId = (id: NavId) => `panel-${id}`;
