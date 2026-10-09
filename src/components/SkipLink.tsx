import React from "react";

export interface SkipLinkProps {
  targetId?: string;
  label?: string;
}

/**
 * Accessible Skip to Content Link.
 * Enables keyboard and screen-reader users to bypass repetitive header navigation (WCAG 2.4.1 Bypass Blocks).
 */
export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} className="sr-only skip-link">
      {label}
    </a>
  );
}
