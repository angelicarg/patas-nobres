// Gold/gem paw mark — replaces the plain 🐾 emoji used across the site's
// logo circles (header, footer, admin login/dashboard, floating assistant
// button, favicon) with something that reads as "topo de linha" rather than
// a generic emoji.
import { useId } from "react";

export default function PawMark({ size = 24 }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D889" />
          <stop offset="55%" stopColor="#D4A93E" />
          <stop offset="100%" stopColor="#A97C1F" />
        </linearGradient>
      </defs>

      {/* main pad */}
      <path
        d="M24 20c6.6 0 12 6.2 12 12.8 0 5.4-4.3 8.7-9.8 8.7-1.6 0-3-.7-4.3-.7-1.3 0-2.7.7-4.3.7-5.5 0-9.8-3.3-9.8-8.7C7.8 26.2 17.4 20 24 20z"
        fill={`url(#${gradientId})`}
      />

      {/* four toe pads */}
      <ellipse cx="12.5" cy="14" rx="4.6" ry="5.8" fill={`url(#${gradientId})`} />
      <ellipse cx="22" cy="9.5" rx="4.6" ry="5.8" fill={`url(#${gradientId})`} />
      <ellipse cx="32" cy="9.8" rx="4.6" ry="5.8" fill={`url(#${gradientId})`} />
      <ellipse cx="40" cy="15.5" rx="4.2" ry="5.4" fill={`url(#${gradientId})`} />

      {/* gem sparkle accent on the main pad */}
      <path
        d="M24 27.5l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z"
        fill="#FFF7E0"
        opacity="0.95"
      />
    </svg>
  );
}
