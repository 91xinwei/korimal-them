import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeInstance } from "globe.gl";
import type { AmbientLight, DirectionalLight, MeshPhongMaterial, Texture } from "three";
import { usePreferences } from "@/hooks/usePreferences";
import type { NodeDisplay } from "@/types/komari";
import { getRegionCoordinates, getRegionDisplayName } from "@/utils/region";

interface RegionCluster {
  id: string;
  code: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  total: number;
  online: number;
  nodes: string[];
}

interface GlobePoint {
  id: string;
  code: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  total: number;
  online: number;
  nodes: string[];
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

function buildClusters(nodes: NodeDisplay[]) {
  const clusters = new Map<string, RegionCluster>();
  for (const node of nodes) {
    const coordinate = getRegionCoordinates(node.region);
    if (!coordinate) continue;
    const current = clusters.get(coordinate.code) ?? {
      id: coordinate.code,
      code: coordinate.code,
      name: getRegionDisplayName(node.region),
      region: node.region || coordinate.code,
      lat: coordinate.latitude,
      lng: coordinate.longitude,
      total: 0,
      online: 0,
      nodes: [],
    };
    current.total += 1;
    if (node.online === true) current.online += 1;
    current.nodes.push(node.name);
    clusters.set(coordinate.code, current);
  }
  return [...clusters.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, "zh-CN"));
}

function getViewCenter(points: GlobePoint[]) {
  if (points.length === 0) return { lat: 28, lng: 105 };
  let longitudeSin = 0;
  let longitudeCos = 0;
  let latitude = 0;
  let weight = 0;
  for (const point of points) {
    const pointWeight = Math.max(1, point.total);
    const radians = point.lng * Math.PI / 180;
    longitudeSin += Math.sin(radians) * pointWeight;
    longitudeCos += Math.cos(radians) * pointWeight;
    latitude += point.lat * pointWeight;
    weight += pointWeight;
  }
  return {
    lat: Math.max(-38, Math.min(48, latitude / weight)),
    lng: Math.atan2(longitudeSin, longitudeCos) * 180 / Math.PI,
  };
}

function getPointsSignature(points: GlobePoint[]) {
  return points
    .map((point) => [point.id, point.total, point.online, point.nodes.join("\u001e")].join("\u001f"))
    .join("\u001d");
}

function createLabelElement(point: object) {
  const data = point as GlobePoint;
  const root = document.createElement("div");
  root.className = "ys-earth-label";
  root.title = `${data.name} · ${data.online}/${data.total} 在线\n${data.nodes.join("、")}`;

  const flag = document.createElement("img");
  flag.className = "ys-earth-label-flag";
  flag.src = `/assets/flags/${data.code}.svg`;
  flag.alt = data.code;
  root.appendChild(flag);

  if (data.total > 1) {
    const count = document.createElement("span");
    count.className = "ys-earth-label-count";
    count.textContent = String(data.total);
    root.appendChild(count);
  }

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
  if (updateTexture) {
    globe.globeImageUrl(dark ? EARTH_NIGHT_TEXTURE : EARTH_DAY_TEXTURE);
  }
  globe
    .pointColor((point: object) => {
      const data = point as GlobePoint;
      if (data.online > 0) return dark ? "rgba(45, 212, 191, 1)" : "rgba(5, 150, 105, .98)";
      return dark ? "rgba(251, 113, 133, .96)" : "rgba(225, 29, 72, .9)";
    })
    .ringColor((point: object) => {
      const data = point as GlobePoint;
      if (data.online > 0) return dark ? "rgba(45, 212, 191, .34)" : "rgba(5, 150, 105, .28)";
      return dark ? "rgba(251, 113, 133, .32)" : "rgba(225, 29, 72, .24)";
    })
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

export const NodeGeoPanel = memo(function NodeGeoPanel({ nodes }: { nodes: NodeDisplay[] }) {
  const { resolvedAppearance } = usePreferences();
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const materialRef = useRef<MeshPhongMaterial | null>(null);
  const lightRigRef = useRef<EarthLightRig | null>(null);
  const specularTextureRef = useRef<Texture | null>(null);
  const appearanceRef = useRef(resolvedAppearance);
  const pointsRef = useRef<GlobePoint[]>([]);
  const pointsSignatureRef = useRef("");
  const syncedPointsSignatureRef = useRef("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const clusters = useMemo(() => buildClusters(nodes), [nodes]);
  const points = useMemo<GlobePoint[]>(() => clusters.map((cluster) => ({ ...cluster })), [clusters]);
  const pointsSignature = useMemo(() => getPointsSignature(points), [points]);
  const online = nodes.filter((node) => node.online === true).length;
  const offline = Math.max(0, nodes.length - online);
  pointsRef.current = points;
  pointsSignatureRef.current = pointsSignature;
  appearanceRef.current = resolvedAppearance;

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || syncedPointsSignatureRef.current === pointsSignature) return;
    globe
      .pointsData(points)
      .ringsData(points)
      .htmlElementsData(points);
    syncedPointsSignatureRef.current = pointsSignature;
  }, [points, pointsSignature]);

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
        const center = getViewCenter(initialPoints);
        const Globe = globeModule.default;
        const globe = new Globe(hostRef.current, {
          rendererConfig: { alpha: true, antialias: true },
        })
          .width(width)
          .height(height)
          .backgroundColor("rgba(0,0,0,0)")
          .globeImageUrl(appearanceRef.current === "dark" ? EARTH_NIGHT_TEXTURE : EARTH_DAY_TEXTURE)
          .bumpImageUrl(EARTH_BUMP_MAP)
          .showAtmosphere(true)
          .pointsData(initialPoints)
          .pointLat("lat")
          .pointLng("lng")
          .pointAltitude(0.008)
          .pointRadius((point: object) => ((point as GlobePoint).online > 0 ? 0.2 : 0.14))
          .pointsMerge(false)
          .pointsTransitionDuration(500)
          .ringsData(initialPoints)
          .ringLat("lat")
          .ringLng("lng")
          .ringMaxRadius(1.25)
          .ringPropagationSpeed(0.72)
          .ringRepeatPeriod(2300)
          .htmlElementsData(initialPoints)
          .htmlLat("lat")
          .htmlLng("lng")
          .htmlAltitude(0.014)
          .htmlElement(createLabelElement)
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
        lightRigRef.current = {
          ambient: ambientLight,
          front: frontLight,
          left: leftFill,
          rear: rearFill,
        };
        globe.lights([
          ambientLight,
          frontLight,
          leftFill,
          rearFill,
        ]);

        const controls = globe.controls();
        controls.autoRotate = !reduceMotion;
        controls.autoRotateSpeed = 1.35;
        controls.enableDamping = true;
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.rotateSpeed = 0.55;
        globe.pointOfView({ lat: center.lat, lng: center.lng, altitude: 1.86 }, 0);
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
  }, []);

  return (
    <section ref={containerRef} className="node-earth-stage" data-state={state} aria-label="节点交互地球">
      <div ref={hostRef} className="node-earth-host" />
      <div className="node-earth-status" aria-hidden>
        <span data-tone="online"><i />{online}</span>
        {offline > 0 && <span data-tone="offline"><i />{offline}</span>}
      </div>
      {state !== "ready" && (
        <div className="node-earth-loading">
          {state === "error" ? "地球渲染不可用" : "正在加载地球"}
        </div>
      )}
      <div className="sr-only">
        {clusters.map((cluster) => `${cluster.name} ${cluster.online}/${cluster.total} 在线`).join("；")}
      </div>
    </section>
  );
});
