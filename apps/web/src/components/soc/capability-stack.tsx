import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COVERAGE = [
  "IDENTITY",
  "ENDPOINT",
  "EMAIL",
  "CLOUD",
  "THREAT INTEL",
  "MITRE ATT&CK",
  "EVIDENCE",
  "VERDICT",
];

function WordStack({
  words,
  eyebrow,
  heading,
  sub,
}: {
  words: string[];
  eyebrow: string;
  heading: string;
  sub: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), 1900);
    return () => window.clearInterval(id);
  }, [words.length]);

  const visible = [-2, -1, 0, 1, 2].map((offset) => {
    const idx = (i + offset + words.length * 10) % words.length;
    return { offset, word: words[idx] };
  });

  return (
    <div className="relative">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#FFFFFF" }}
        >
          {eyebrow}
        </div>
        <h2
          className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-white md:text-[44px]"
          style={{ fontFamily: 'Geist, "Inter", system-ui, sans-serif' }}
        >
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-[1.6] text-white/60">{sub}</p>
      </div>

      <div className="relative mx-auto mt-12 aspect-[16/7] max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#111111]/60 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16) 0%, transparent 65%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.08]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#111111] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#111111] to-transparent" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {visible.map(({ offset, word }) => {
            const isActive = offset === 0;
            const dist = Math.abs(offset);
            const blur = isActive ? 0 : dist === 1 ? 4 : 9;
            const opacity = isActive ? 1 : dist === 1 ? 0.5 : 0.22;
            const scale = isActive ? 1 : dist === 1 ? 0.9 : 0.78;
            return (
              <AnimatePresence key={`${offset}-${word}`} mode="popLayout">
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20, filter: `blur(${blur}px)` }}
                  animate={{
                    opacity,
                    y: 0,
                    filter: `blur(${blur}px)`,
                    scale,
                  }}
                  exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center text-3xl font-semibold tracking-tight text-white md:text-5xl"
                  style={{
                    fontFamily: 'Geist, "Inter", system-ui, sans-serif',
                    textShadow: isActive ? "0 0 32px rgba(255,255,255,0.55)" : "none",
                  }}
                >
                  {word}
                </motion.div>
              </AnimatePresence>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CapabilityStack() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <WordStack
        words={COVERAGE}
        eyebrow="Coverage"
        heading="Every domain a real SOC touches, one platform."
        sub="Practice across the surfaces attackers actually move through — not a quiz, an investigation."
      />
    </section>
  );
}
