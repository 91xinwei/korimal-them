import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeInstance } from "globe.gl";
import type { AmbientLight, DirectionalLight, MeshPhongMaterial, Texture } from "three";
import { maskIpAddress } from "@/adapters/static-ip-adapter";
import { usePreferences } from "@/hooks/usePreferences";
import type { NetworkAssetNode } from "@/types/network";

interface GlobePoint {
  id: string;
  code: string;
  name: string;
  type: NetworkAssetNode["type"];
  status: NetworkAssetNode["status"];
  country: string;
  city?: string;
  provider?: string;
  isp?: string;
  asn?: string;
  ip?: string;
  latency?: number;
  lat: number;
  lng: number;
}

interface GlobeArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startType: NetworkAssetNode["type"];
  endType: NetworkAssetNode["type"];
  status: NetworkAssetNode["status"];
}

interface EarthLightRig {
  ambient: AmbientLight;
  front: DirectionalLight;
  left: DirectionalLight;
  rear: DirectionalLight;
}

const EARTH_DAY_TEXTURE = "/assets/earth/earth-blue-marble.jpg";
const EARTH_NIGHT_TEXTURE = "/assets/earth/earth-night.jpg";
const EARTH_BUMP_MAP = "/assets/earth/earth-topology.png";
const EARTH_SPECULAR_MAP = "/assets/earth/earth-water.png";

function buildPoints(nodes: NetworkAssetNode[]): GlobePoint[] {
  return nodes.flatMap((node) => {
    if (node.latitude == null || node.longitude == null) return [];
    return [{
      id: node.id,
      code: node.countryCode ?? "UN",
      name: node.name,
      type: node.type,
      status: node.status,
      country: node.country,
      city: node.city,
      provider: node.provider,
      isp: node.type === "static" ? node.isp : undefined,
      asn: node.type === "static" ? node.asn : undefined,
      ip: node.type === "static" ? maskIpAddress(node.ipv4 ?? node.ipv6) : node.ipv4,
      latency: node.latency,
      lat: node.latitude,
      lng: node.longitude,
    }];
  });
}

function getViewCenter(points: GlobePoint[]) {
  if (points.length === 0) return { lat: 28, lng: 105 };
  let longitudeSin = 0;
  let longitudeCos = 0;
  let latitude = 0;
  for (const point of points) {
    const radians = point.lng * Math.PI / 180;
    longitudeSin += Math.sin(radians);
    longitudeCos += Math.cos(radians);
    latitude += point.lat;
  }
  return {
    lat: Math.max(-38, Math.min(48, latitude / points.length)),
    lng: Math.atan2(longitudeSin, longitudeCos) * 180 / Math.PI,
  };
}

function getPointsSignature(points: GlobePoint[]) {
  return points
    .map((point) => [point.id, point.type, point.status, point.lat, point.lng, point.latency, point.ip].join("\u001f"))
    .join("\u001d");
}

function buildArcs(points: GlobePoint[]): GlobeArc[] {
  if (points.length < 2) return [];
  const hub = points.find((point) => point.type === "vps" && point.status !== "offline")
    ?? points.find((point) => point.status !== "offline")
    ?? points[0];

  return points
    .filter((point) => point.id !== hub.id)
    .slice(0, 72)
    .map((point) => ({
      id: `${hub.id}:${point.id}`,
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: point.lat,
      endLng: point.lng,
      startType: hub.type,
      endType: point.type,
      status: point.status === "warning" || hub.status === "warning"
        ? "warning"
        : point.status === "offline" || hub.status === "offline"
          ? "offline"
          : "online",
    }));
}

function arcEndpointColor(type: NetworkAssetNode["type"], status: NetworkAssetNode["status"]) {
  if (status === "offline") return "rgba(100, 116, 139, .34)";
  if (status === "warning") return "rgba(251, 146, 60, .82)";
  return type === "static" ? "rgba(52, 211, 153, .76)" : "rgba(56, 189, 248, .76)";
}

function arcColors(arc: GlobeArc) {
  return [arcEndpointColor(arc.startType, arc.status), arcEndpointColor(arc.endType, arc.status)];
}

function pointColor(point: GlobePoint, dark: boolean) {
  if (point.status === "offline") return dark ? "rgba(148, 163, 184, .9)" : "rgba(100, 116, 139, .9)";
  if (point.status === "warning") return dark ? "rgba(251, 146, 60, 1)" : "rgba(234, 88, 12, .98)";
  if (point.type === "static") return dark ? "rgba(52, 211, 153, 1)" : "rgba(5, 150, 105, .98)";
  return dark ? "rgba(96, 165, 250, 1)" : "rgba(37, 99, 235, .98)";
}

function pointTooltip(point: GlobePoint) {
  return [
    point.name,
    point.type === "vps" ? "VPS" : "Static IP",
    [point.city, point.country].filter(Boolean).join(", "),
    point.provider || point.isp,
    point.asn,
    point.ip,
    point.latency != null ? `${point.latency} ms` : undefined,
    point.status,
  ].filter(Boolean).join("\n");
}

function createLabelElement(point: GlobePoint, onSelect: (nodeId: string) => void) {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "ys-earth-label network-earth-label";
  root.dataset.type = point.type;
  root.dataset.status = point.status;
  root.title = pointTooltip(point);
  root.setAttribute("aria-label", `${point.name}, ${point.type}, ${point.status}`);
  root.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(point.id);
  });

  const flag = document.createElement("img");
  flag.className = "ys-earth-label-flag";
  flag.src = `/assets/flags/${point.code}.svg`;
  flag.alt = point.code;
  root.appendChild(flag);

  const marker = document.createElement("span");
  marker.className = "network-earth-label-marker";
  marker.textContent = point.type === "static" ? "S" : "V";
  root.appendChild(marker);
  return root;
}

function applyAppearance(
  globe: GlobeInstance | null,
  material: MeshPhongMaterial | null,
  lights: EarthLightRig | null,
  appearance: "light" | "dark",
  updateTexture = true,
) {
  if (!globe || !material) return;
  const dark = appearance === "dark";
  if (updateTexture) globe.globeImageUrl(dark ? EARTH_NIGHT_TEXTURE : EARTH_DAY_TEXTURE);
  globe
    .pointColor((point: object) => pointColor(point as GlobePoint, dark))
    .ringColor((point: object) => pointColor(point as GlobePoint, dark))
    .atmosphereColor(dark ? "#38bdf8" : "#60a5fa")
    .atmosphereAltitude(dark ? 0.14 : 0.105);
  material.bumpScale = dark ? 0.018 : 0.03;
  material.shininess = dark ? 8 : 14;
  material.emissive.set(dark ? 0x17324f : 0x294f70);
  material.emissiveIntensity = dark ? 0.48 : 0.28;
  material.specular.set(dark ? 0x64748b : 0x475569);
  material.needsUpdate = true;
  if (lights) {
    lights.ambient.intensity = dark ? 1.85 : 1.45;
    lights.front.intensity = dark ? 0.9 : 1;
    lights.left.intensity = dark ? 0.62 : 0.48;
    lights.rear.intensity = dark ? 0.52 : 0.38;
  }
}

export const NodeGeoPanel = memo(function NodeGeoPanel({
  nodes,
  defaultZoom = 1.86,
  onNodeClick,
}: {
  nodes: NetworkAssetNode[];
  defaultZoom?: number;
  onNodeClick?: (nodeId: string) => void;
}) {
  const { resolvedAppearance } = usePreferences();
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const materialRef = useRef<MeshPhongMaterial | null>(null);
  const lightRigRef = useRef<EarthLightRig | null>(null);
  const specularTextureRef = useRef<Texture | null>(null);
  const appearanceRef = useRef(resolvedAppearance);
  const pointsRef = useRef<GlobePoint[]>([]);
  const clickRef = useRef(onNodeClick);
  const pointsSignatureRef = useRef("");
  const syncedPointsSignatureRef = useRef("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const points = useMemo(() => buildPoints(nodes), [nodes]);
  const arcs = useMemo(() => buildArcs(points), [points]);
  const pointsSignature = useMemo(() => getPointsSignature(points), [points]);
  const counts = useMemo(() => ({
    vps: nodes.filter((node) => node.type === "vps" && node.status !== "offline").length,
    static: nodes.filter((node) => node.type === "static" && node.status !== "offline").length,
    warning: nodes.filter((node) => node.status === "warning").length,
    offline: nodes.filter((node) => node.status === "offline").length,
  }), [nodes]);
  pointsRef.current = points;
  pointsSignatureRef.current = pointsSignature;
  appearanceRef.current = resolvedAppearance;
  clickRef.current = onNodeClick;

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || syncedPointsSignatureRef.current === pointsSignature) return;
    globe.pointsData(points).ringsData(points).htmlElementsData(points).arcsData(arcs);
    syncedPointsSignatureRef.current = pointsSignature;
  }, [arcs, points, pointsSignature]);

  useEffect(() => {
    applyAppearance(globeRef.current, materialRef.current, lightRigRef.current, resolvedAppearance);
  }, [resolvedAppearance]);

  useEffect(() => {
    const container = containerRef.current;
    const host = hostRef.current;
    if (!container || !host) return;

    let disposed = false;
    let elementVisible = true;
    let animationActive: boolean | null = null;
    let renderWidth = 0;
    let renderHeight = 0;
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = reduceMotionQuery.matches;

    const updateAnimation = () => {
      const globe = globeRef.current;
      if (!globe) return;
      const active = elementVisible && document.visibilityState === "visible";
      const controls = globe.controls();
      controls.autoRotate = active && !reduceMotion;
      if (animationActive === active) return;
      animationActive = active;
      if (active) globe.resumeAnimation();
      else globe.pauseAnimation();
    };

    const resize = () => {
      const globe = globeRef.current;
      if (!globe) return;
      const rect = container.getBoundingClientRect();
      const width = Math.max(280, Math.round(rect.width));
      const height = Math.max(280, Math.round(rect.height || rect.width));
      if (width === renderWidth && height === renderHeight) return;
      renderWidth = width;
      renderHeight = height;
      globe.width(width).height(height);
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      elementVisible = entry?.isIntersecting ?? true;
      updateAnimation();
    }, { rootMargin: "120px" });
    const onVisibilityChange = () => updateAnimation();
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
      updateAnimation();
    };

    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reduceMotionQuery.addEventListener("change", onMotionPreferenceChange);

    void Promise.all([import("globe.gl"), import("three")])
      .then(([globeModule, THREE]) => {
        if (disposed || !hostRef.current) return;
        const rect = container.getBoundingClientRect();
        const width = Math.max(280, Math.round(rect.width));
        const height = Math.max(280, Math.round(rect.height || rect.width));
        renderWidth = width;
        renderHeight = height;
        const initialPoints = pointsRef.current;
        const initialArcs = buildArcs(initialPoints);
        const center = getViewCenter(initialPoints);
        const Globe = globeModule.default;
        const globe = new Globe(hostRef.current, { rendererConfig: { alpha: true, antialias: true } })
          .width(width)
          .height(height)
          .backgroundColor("rgba(0,0,0,0)")
          .globeImageUrl(appearanceRef.current === "dark" ? EARTH_NIGHT_TEXTURE : EARTH_DAY_TEXTURE)
          .bumpImageUrl(EARTH_BUMP_MAP)
          .showAtmosphere(true)
          .pointsData(initialPoints)
          .pointLat("lat")
          .pointLng("lng")
          .pointAltitude(0.009)
          .pointRadius((point: object) => (point as GlobePoint).type === "static" ? 0.18 : 0.15)
          .pointsMerge(false)
          .pointsTransitionDuration(500)
          .ringsData(initialPoints)
          .ringLat("lat")
          .ringLng("lng")
          .ringMaxRadius(1.05)
          .ringPropagationSpeed(0.68)
          .ringRepeatPeriod(2500)
          .arcsData(initialArcs)
          .arcStartLat("startLat")
          .arcStartLng("startLng")
          .arcEndLat("endLat")
          .arcEndLng("endLng")
          .arcColor((arc: object) => arcColors(arc as GlobeArc))
          .arcAltitudeAutoScale(0.28)
          .arcStroke(0.32)
          .arcDashLength(0.34)
          .arcDashGap(0.72)
          .arcDashInitialGap((arc: object) => (arc as GlobeArc).id.length % 5)
          .arcDashAnimateTime(2200)
          .arcsTransitionDuration(650)
          .htmlElementsData(initialPoints)
          .htmlLat("lat")
          .htmlLng("lng")
          .htmlAltitude(0.014)
          .htmlElement((point: object) =>
            createLabelElement(point as GlobePoint, (nodeId) => clickRef.current?.(nodeId)))
          .htmlElementVisibilityModifier((element: HTMLElement, visible: boolean) => {
            element.style.opacity = visible ? "1" : "0";
            element.style.filter = visible ? "blur(0)" : "blur(12px)";
          })
          .htmlTransitionDuration(420)
          .onGlobeReady(() => {
            if (!disposed) setState("ready");
          });

        globeRef.current = globe;
        syncedPointsSignatureRef.current = pointsSignatureRef.current;
        const renderer = globe.renderer();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.style.background = "transparent";

        const material = globe.globeMaterial();
        if ("shininess" in material) {
          materialRef.current = material as MeshPhongMaterial;
          specularTextureRef.current = new THREE.TextureLoader().load(EARTH_SPECULAR_MAP, () => {
            if (!materialRef.current || disposed) return;
            materialRef.current.specularMap = specularTextureRef.current;
            materialRef.current.needsUpdate = true;
          });
        }

        const frontLight = new THREE.DirectionalLight(0xffffff, 1);
        frontLight.position.set(1.2, 1.1, 1.6);
        const leftFill = new THREE.DirectionalLight(0xdbeafe, 0.48);
        leftFill.position.set(-1.2, 0.2, 1.2);
        const rearFill = new THREE.DirectionalLight(0xe0f2fe, 0.38);
        rearFill.position.set(-1, -0.8, -1.2);
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
        lightRigRef.current = { ambient: ambientLight, front: frontLight, left: leftFill, rear: rearFill };
        globe.lights([ambientLight, frontLight, leftFill, rearFill]);

        const controls = globe.controls();
        controls.autoRotate = !reduceMotion;
        controls.autoRotateSpeed = 1.15;
        controls.enableDamping = true;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.rotateSpeed = 0.55;
        globe.pointOfView({ lat: center.lat, lng: center.lng, altitude: defaultZoom }, 0);
        applyAppearance(globe, materialRef.current, lightRigRef.current, appearanceRef.current, false);
        updateAnimation();
      })
      .catch(() => {
        if (!disposed) setState("error");
      });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reduceMotionQuery.removeEventListener("change", onMotionPreferenceChange);
      const globe = globeRef.current;
      if (globe) {
        globe.pauseAnimation();
        globe._destructor();
      }
      globeRef.current = null;
      materialRef.current = null;
      lightRigRef.current = null;
      specularTextureRef.current?.dispose();
      specularTextureRef.current = null;
      host.replaceChildren();
    };
  }, [defaultZoom]);

  return (
    <div ref={containerRef} className="node-earth-stage" data-state={state} aria-label="Network asset globe">
      <div ref={hostRef} className="node-earth-host" />
      <div className="node-earth-status" aria-hidden>
        <span data-tone="vps"><i />{counts.vps}</span>
        <span data-tone="static"><i />{counts.static}</span>
        {counts.warning > 0 && <span data-tone="warning"><i />{counts.warning}</span>}
        {counts.offline > 0 && <span data-tone="offline"><i />{counts.offline}</span>}
      </div>
      {state !== "ready" && (
        <div className="node-earth-loading">
          {state === "error" ? "Global map unavailable" : "Loading global map"}
        </div>
      )}
      <div className="sr-only">
        {points.map((point) => pointTooltip(point).replaceAll("\n", ", ")).join("; ")}
      </div>
    </div>
  );
});
