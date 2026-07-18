import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  CircleUserRound,
  Clock3,
  MapPin,
  Monitor,
  Network,
  X,
} from "lucide-react";

interface VisitorData {
  ip: string;
  country: string;
  region: string;
  city: string;
  org: string;
  isp: string;
  asn: string;
}

interface VisitorProvider {
  url: string;
  normalize: (value: unknown) => VisitorData | null;
}

const EMPTY_VISITOR: VisitorData = {
  ip: "",
  country: "",
  region: "",
  city: "",
  org: "",
  isp: "",
  asn: "",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function normalizeAsn(...values: unknown[]) {
  const value = pickString(...values);
  if (!value) return "";
  return /^AS/i.test(value) ? value.toUpperCase() : `AS${value}`;
}

function normalizeVisitor(value: unknown, kind: "ipwho" | "ipapi" | "ipsb") {
  const data = asRecord(value);
  const connection = asRecord(data.connection);
  const ip = pickString(data.ip);
  if (!ip) return null;
  if (kind === "ipwho" && data.success === false) return null;

  return {
    ip,
    country: pickString(data.country, data.country_name),
    region: pickString(data.region, data.region_name),
    city: pickString(data.city),
    org: pickString(connection.org, data.organization, data.org),
    isp: pickString(connection.isp, data.isp, data.organization, data.org),
    asn: normalizeAsn(connection.asn, data.asn),
  } satisfies VisitorData;
}

const PROVIDERS: VisitorProvider[] = [
  { url: "https://ipwho.is/", normalize: (value) => normalizeVisitor(value, "ipwho") },
  { url: "https://ipapi.co/json/", normalize: (value) => normalizeVisitor(value, "ipapi") },
  { url: "https://api.ip.sb/geoip", normalize: (value) => normalizeVisitor(value, "ipsb") },
];

async function fetchProvider(provider: VisitorProvider) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(provider.url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return provider.normalize(await response.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadVisitorData() {
  for (const provider of PROVIDERS) {
    const data = await fetchProvider(provider);
    if (data) return data;
  }
  return null;
}

function getClientName() {
  const agent = navigator.userAgent;
  const browser = agent.includes("Edg/")
    ? "Edge"
    : agent.includes("Firefox/")
      ? "Firefox"
      : agent.includes("Chrome/")
        ? "Chrome"
        : agent.includes("Safari/")
          ? "Safari"
          : "浏览器";
  const system = agent.includes("Windows")
    ? "Windows"
    : agent.includes("Android")
      ? "Android"
      : /iPhone|iPad/.test(agent)
        ? "iOS"
        : agent.includes("Mac OS")
          ? "macOS"
          : agent.includes("Linux")
            ? "Linux"
            : "未知设备";
  return `${browser} · ${system}`;
}

export function VisitorInfo({ showTrigger = true }: { showTrigger?: boolean }) {
  const [visitor, setVisitor] = useState(EMPTY_VISITOR);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const clientName = useMemo(getClientName, []);

  useEffect(() => {
    let cancelled = false;
    const promptTimer = window.setTimeout(() => setOpen(true), 520);
    const load = () => {
      setState("loading");
      void loadVisitorData().then((data) => {
        if (cancelled) return;
        if (data) {
          setVisitor(data);
          setState("ready");
        } else {
          setState("error");
        }
      });
    };
    const loadTimer = window.setTimeout(load, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(promptTimer);
      window.clearTimeout(loadTimer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !dialogRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const location = [visitor.city, visitor.region, visitor.country].filter(Boolean).join(" · ");
  const provider = Array.from(new Set([visitor.isp || visitor.org, visitor.asn].filter(Boolean))).join(" · ");
  const organization = visitor.org && visitor.org !== visitor.isp ? visitor.org : "";

  return (
    <>
      {showTrigger && (
        <div ref={rootRef} className="visitor-info" data-state={state}>
          <button
            type="button"
            className="visitor-info-trigger"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="dialog"
            title="查看访客网络信息"
          >
            <CircleUserRound size={15} />
            <span>访客信息</span>
            <i aria-hidden />
          </button>
        </div>
      )}

      {open && createPortal(
        <div ref={dialogRef} className="visitor-info-popover" role="dialog" aria-label="访客网络信息">
          <div className="visitor-info-head">
            <span className="visitor-info-avatar"><CircleUserRound size={19} /></span>
            <span>
              <strong>欢迎访问</strong>
            </span>
            <button type="button" onClick={() => setOpen(false)} title="关闭" aria-label="关闭访客信息">
              <X size={15} />
            </button>
          </div>

          <div className="visitor-info-address">
            <strong className="tabular">{visitor.ip || (state === "error" ? "未获取到公网 IP" : "正在获取公网 IP")}</strong>
            <span><MapPin size={12} />{location || "地区信息暂不可用"}</span>
          </div>

          <div className="visitor-info-details">
            <div><Network size={13} /><span>{provider || (state === "error" ? "服务商信息暂不可用" : "正在获取服务商信息")}</span></div>
            {organization && <div><Building2 size={13} /><span>{organization}</span></div>}
            <div><Monitor size={13} /><span>{clientName}</span></div>
            <div><Clock3 size={13} /><span>{new Date().toLocaleString("zh-CN", { hour12: false })}</span></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
