import { Outlet } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { BackgroundBoard } from "./BackgroundBoard";
import { useAppearance } from "@/hooks/useAppearance";

const FloatingControls = lazy(() =>
  import("./FloatingControls").then((module) => ({ default: module.FloatingControls })),
);

function DeferredFloatingControls() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const showControls = () => {
      if (!cancelled) setReady(true);
    };

    if (
      typeof idleWindow.requestIdleCallback === "function" &&
      typeof idleWindow.cancelIdleCallback === "function"
    ) {
      const idleId = idleWindow.requestIdleCallback(showControls, { timeout: 1200 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timer = globalThis.setTimeout(showControls, 180);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <FloatingControls />
    </Suspense>
  );
}

export function AppShell() {
  useAppearance();
  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundBoard />
      <DeferredFloatingControls />
      <main className="relative z-[1] flex-1 px-3 pb-8 pt-5 sm:px-5 md:px-6 lg:px-8 lg:pt-6">
        <div className="mx-auto w-full max-w-[1720px]">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer relative z-[1]">
        <div className="site-footer-inner">Powered by Komari Monitor.</div>
      </footer>
    </div>
  );
}
