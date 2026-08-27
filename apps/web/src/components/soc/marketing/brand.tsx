/** The ThreatLens mark. */
export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-black ${className}`}
    >
      <img
        src="/brand-mark.png"
        alt="ThreatLens"
        className="size-full object-cover"
        draggable={false}
      />
    </span>
  );
}

/** Nav/footer wordmark: "ThreatLens". */
export function BrandLockup({ size = "nav" }: { size?: "nav" | "footer" }) {
  const big = size === "nav";
  return (
    <span className={`font-semibold tracking-[-0.02em] ${big ? "text-[15px]" : "text-[14px]"}`}>
      ThreatLens
    </span>
  );
}
