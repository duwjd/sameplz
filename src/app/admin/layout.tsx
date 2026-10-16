import type { Metadata } from "next";
import type { ReactNode } from "react";

// ADM: every page checks requireAdmin() itself (a layout does not re-run on client navigation).
export const metadata: Metadata = {
  title: "운영 · SAMEPLZ",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
