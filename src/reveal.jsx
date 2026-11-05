import { useEffect, useMemo, useState } from "react";
import { useLang } from "./i18n.jsx";

// The backend returns each answer whole, so this is a visual effect, not real streaming.
const REVEAL_MS = 1800;
const TICK_MS = 30;
const MS_PER_CHUNK = 28;

const prefersStill = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Words for text. Tables and code stay whole: half a table renders as broken pipes and dashes.
function toChunks(markdown) {
  const chunks = [];
  let block = [];
  let inFence = false;
  const flushBlock = () => {
    if (block.length) chunks.push(block.join("\n") + "\n");
    block = [];
  };
  for (const line of markdown.split("\n")) {
    const fence = line.trimStart().startsWith("```");
    if (inFence || fence) {
      block.push(line);
      if (fence) inFence = !inFence;
      if (!inFence) flushBlock();
    } else if (line.trimStart().startsWith("|")) {
      block.push(line);
    } else {
      flushBlock();
      for (const part of line.split(/(\s+)/)) if (part) chunks.push(part);
      chunks.push("\n");
    }
  }
  flushBlock();
  return chunks;
}

export function useReveal(text, enabled, onProgress) {
  const chunks = useMemo(() => toChunks(text), [text]);
  const skip = !enabled || prefersStill();
  const [shown, setShown] = useState(skip ? chunks.length : 0);

  useEffect(() => {
    if (skip) return undefined;
    // Long answers speed up, so the effect never adds more than REVEAL_MS.
    const duration = Math.min(REVEAL_MS, chunks.length * MS_PER_CHUNK);
    const step = Math.max(1, Math.ceil(chunks.length / (duration / TICK_MS)));
    const timer = setInterval(() => {
      setShown((n) => {
        const next = Math.min(chunks.length, n + step);
        if (next >= chunks.length) clearInterval(timer);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [chunks, skip]);

  useEffect(() => {
    if (!skip) onProgress?.();
    // onProgress is a new function on every render; only `shown` should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const done = shown >= chunks.length;
  return { text: done ? text : chunks.slice(0, shown).join(""), done };
}

// How long each stage shows. The last stays until the answer arrives.
const STAGE_MS = [1200, 2800];

export function ThinkingLabel() {
  const { t } = useLang();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (prefersStill() || stage >= STAGE_MS.length) return undefined;
    const timer = setTimeout(() => setStage((s) => s + 1), STAGE_MS[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  return (
    <span className="typing__text" key={stage}>
      {t.thinkingStages[stage]}
    </span>
  );
}
