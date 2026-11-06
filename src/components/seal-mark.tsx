import { sealEarned } from "@/lib/readings";

const BEADS = [
  ["80", "14"],
  ["113", "22.84"],
  ["137.16", "47"],
  ["146", "80"],
  ["137.16", "113"],
  ["113", "137.16"],
  ["80", "146"],
  ["47", "137.16"],
  ["22.84", "113"],
  ["14", "80"],
  ["22.84", "47"],
  ["47", "22.84"],
] as const;

export function SealMark({ times, className = "size-40" }: { times: number; className?: string }) {
  const earned = sealEarned(times);
  const filled = earned === 0 ? 0 : earned === 1 ? 1 : earned === 5 ? 2 : 2 + earned / 10;
  const gold = earned >= 10;
  const ink = gold ? "#1c1612" : "#f3efe4";
  const face = earned === 0 ? "none" : gold ? "#8d6b32" : "#7a2e38";
  const label = earned === 0 ? "The seal is still empty" : `Seal for reading the Injeel ${earned === 1 ? "once" : `${earned} times`}`;

  return (
    <svg viewBox="0 0 160 160" className={className} role="img" aria-label={label}>
      <circle cx="80" cy="80" r="74" fill="none" stroke="#d9d0c0" strokeWidth="1" />
      {earned >= 5 && <circle cx="80" cy="80" r="71" fill="none" stroke="#8d6b32" strokeWidth="1.5" />}
      {earned >= 50 && <circle cx="80" cy="80" r="62" fill="none" stroke={gold ? "#7a2e38" : "#8d6b32"} strokeWidth="1" />}
      {earned > 0 && <circle cx="80" cy="80" r="56" fill={face} />}
      {BEADS.map(([cx, cy], index) => {
        const on = index < filled;
        return (
          <circle
            key={index}
            cx={cx}
            cy={cy}
            r={on ? "3.2" : "1.6"}
            fill={on ? "#8d6b32" : "#d9d0c0"}
          />
        );
      })}
      {earned > 0 && (
        <text
          x="80"
          y="92"
          textAnchor="middle"
          fill={ink}
          fontFamily="Newsreader, Palatino, serif"
          fontSize={earned >= 100 ? 40 : 48}
        >
          {earned}
        </text>
      )}
    </svg>
  );
}
