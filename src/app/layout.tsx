import type { ReactNode } from "react";

// The locale layout renders <html> and <body>. This root layout only exists
// so that the not-found boundary for unknown top-level paths has a parent.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
