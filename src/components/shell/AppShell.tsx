import { Outlet, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { BackgroundBoard } from "./BackgroundBoard";
import { useAppearance } from "@/hooks/useAppearance";
import { OrbitalSidebar } from "./OrbitalSidebar";

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
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const scrollToTarget = () => {
      const target = document.getElementById(id);
      if (!target) return false;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };
    if (scrollToTarget()) return;
    const observer = new MutationObserver(() => {
      if (scrollToTarget()) observer.disconnect();
    });
    observer.observe(document.getElementById("root") ?? document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 10_000);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [location.hash, location.pathname]);

  return (
    <div className="orbital-shell relative min-h-screen">
      <BackgroundBoard />
      <DeferredFloatingControls />
      <OrbitalSidebar />
      <div className="orbital-content">
        <main className="relative z-[1] flex-1 px-3 pb-8 pt-5 sm:px-5 md:px-6 lg:px-8 lg:pt-6">
          <div className="mx-auto w-full max-w-[1720px]">
            <Outlet />
          </div>
        </main>
        <footer className="site-footer relative z-[1]">
          <div className="site-footer-inner">Powered by Komari Monitor.</div>
        </footer>
      </div>
    </div>
  );
}
