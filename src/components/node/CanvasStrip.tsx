import { useEffect, useRef, useState, type PointerEvent } from "react";

interface CanvasStripProps {
  className?: string;
  height: number;
  ariaHidden?: boolean;
  redrawKey?: string | number;
  draw: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    now: number,
  ) => void;
  animated?: boolean;
  frameIntervalMs?: number;
  getHoverIndex?: (offsetX: number, width: number) => number | null;
  onHoverIndex?: (index: number | null) => void;
}

interface AnimationSubscriber {
  paint: (now: number) => void;
  frameIntervalMs: number;
  lastPaintAt: number;
}

const MAX_CANVAS_DPR = 1.5;
const animationSubscribers = new Set<AnimationSubscriber>();
const resizeCallbacks = new WeakMap<Element, () => void>();
const visibilityCallbacks = new WeakMap<Element, (visible: boolean) => void>();
let animationFrameId: number | null = null;
let sharedResizeObserver: ResizeObserver | null = null;
let sharedIntersectionObserver: IntersectionObserver | null = null;

function runAnimationLoop(now: number) {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    animationFrameId = window.requestAnimationFrame(runAnimationLoop);
    return;
  }

  for (const subscriber of animationSubscribers) {
    if (now - subscriber.lastPaintAt < subscriber.frameIntervalMs) continue;
    subscriber.lastPaintAt = now;
    subscriber.paint(now);
  }

  if (animationSubscribers.size > 0) {
    animationFrameId = window.requestAnimationFrame(runAnimationLoop);
  } else {
    animationFrameId = null;
  }
}

function subscribeAnimation(subscriber: AnimationSubscriber) {
  animationSubscribers.add(subscriber);
  if (animationFrameId == null) {
    animationFrameId = window.requestAnimationFrame(runAnimationLoop);
  }

  return () => {
    animationSubscribers.delete(subscriber);
    if (animationSubscribers.size === 0 && animationFrameId != null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };
}

function getSharedResizeObserver() {
  if (typeof ResizeObserver === "undefined") return null;
  sharedResizeObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      resizeCallbacks.get(entry.target)?.();
    }
  });
  return sharedResizeObserver;
}

function observeResize(element: Element, callback: () => void) {
  const observer = getSharedResizeObserver();
  if (!observer) return () => undefined;

  resizeCallbacks.set(element, callback);
  observer.observe(element);
  return () => {
    resizeCallbacks.delete(element);
    observer.unobserve(element);
  };
}

function getSharedIntersectionObserver() {
  if (typeof IntersectionObserver === "undefined") return null;
  sharedIntersectionObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visibilityCallbacks
          .get(entry.target)
          ?.(entry.isIntersecting || entry.intersectionRatio > 0);
      }
    },
    { rootMargin: "180px" },
  );
  return sharedIntersectionObserver;
}

function observeVisibility(element: Element, callback: (visible: boolean) => void) {
  const observer = getSharedIntersectionObserver();
  if (!observer) return () => undefined;

  visibilityCallbacks.set(element, callback);
  observer.observe(element);
  return () => {
    visibilityCallbacks.delete(element);
    observer.unobserve(element);
  };
}

export function resolveCssColor(
  color: string,
  styles = getComputedStyle(document.documentElement),
): string {
  let resolvedColor = color;

  for (let guard = 0; guard < 8; guard += 1) {
    const start = resolvedColor.indexOf("var(");
    if (start < 0) return resolvedColor;

    let depth = 0;
    let end = -1;
    for (let index = start; index < resolvedColor.length; index += 1) {
      const char = resolvedColor[index];
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }

    if (end < 0) return resolvedColor;

    const body = resolvedColor.slice(start + 4, end);
    let commaIndex = -1;
    depth = 0;
    for (let index = 0; index < body.length; index += 1) {
      const char = body[index];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) {
        commaIndex = index;
        break;
      }
    }

    const name = (commaIndex >= 0 ? body.slice(0, commaIndex) : body).trim();
    const fallback = commaIndex >= 0 ? body.slice(commaIndex + 1).trim() : "";
    const value = name.startsWith("--") ? styles.getPropertyValue(name).trim() : "";
    const replacement = value || (fallback ? resolveCssColor(fallback, styles) : "");
    if (!replacement) return resolvedColor;

    resolvedColor = `${resolvedColor.slice(0, start)}${replacement}${resolvedColor.slice(end + 1)}`;
  }

  return resolvedColor;
}

export function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
  ctx.fill();
}

export function CanvasStrip({
  className,
  height,
  ariaHidden = false,
  redrawKey,
  draw,
  animated = false,
  frameIntervalMs = 1000 / 24,
  getHoverIndex,
  onHoverIndex,
}: CanvasStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visibleRef = useRef(true);
  const resizeFrameRef = useRef<number | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const measureWidth = () => {
      const nextWidth = Math.round(canvas.clientWidth);
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    const scheduleWidthUpdate = () => {
      if (resizeFrameRef.current != null) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        measureWidth();
      });
    };

    measureWidth();
    const unobserve = observeResize(canvas, scheduleWidthUpdate);
    return () => {
      unobserve();
      if (resizeFrameRef.current != null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    return observeVisibility(canvas, (visible) => {
      visibleRef.current = visible;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = (now: number) => {
      if (animated && !visibleRef.current) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      draw(ctx, width, height, now);
    };

    if (!animated) {
      paint(performance.now());
      return;
    }

    const startedAt = performance.now();
    paint(startedAt);
    return subscribeAnimation({
      paint,
      frameIntervalMs,
      lastPaintAt: startedAt,
    });
  }, [animated, draw, frameIntervalMs, height, redrawKey, width]);

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!getHoverIndex || !onHoverIndex || width <= 0) return;
    onHoverIndex(getHoverIndex(event.nativeEvent.offsetX, width));
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height }}
      aria-hidden={ariaHidden}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHoverIndex?.(null)}
    />
  );
}
