# Design QA — Komari network assets

- Source visual truth: `/var/folders/1p/g3r0l6w55bz3_18288vjk1gm0000gn/T/codex-clipboard-8f279591-df6f-40c3-93ad-75bf7f2f481c.png`
- Source pixels: 844 × 1326; interpreted at 2× density as a 422 × 663 CSS-pixel card reference.
- Implementation: `http://127.0.0.1:5173/` with a local Komari-compatible fixture API.
- Implementation screenshot evidence: Codex in-app Browser tool-native captures from the 375px iframe validation page and the full local preview. The current browser surface does not expose a filesystem export path for its captures.
- Viewports: normal in-app browser viewport plus an explicit 375 × 780 CSS-pixel iframe viewport at device density 1.
- State: light appearance; one live VPS fixture and one live Static IP fixture; all-assets and Static-IP-only filter states.

## Full-view comparison evidence

The reference was displayed at 422 × 663 beside the implementation. The existing VPS card retained its two-column metric hierarchy, thin separators, rounded white/glass surface, compact labels, colored metric bars, traffic split, quota row, connection counts, uptime/expiry and green price treatment. The project’s pre-existing generic Ping presentation remains intentionally unchanged because the task explicitly prohibits redesigning the VPS Card.

The new network page was also checked at 375px. Network Overview collapses to two columns, the map and filters remain within the viewport, and both VPS and Static IP cards render without horizontal overflow.

## Focused region evidence

- VPS lower section: traffic quota, TCP/UDP, expiry/uptime and monthly price were inspected at 375px.
- Static IP full card: identity, masked IP, ASN/provider/location, network quality, risk/detection, unlock matrix, last check and price were inspected at 375px.
- Map/filter behavior: selecting `Static IP` updated the count and map data from 2 assets to 1; selecting the map marker scrolled to and highlighted the Static IP card.

## Findings

No actionable P0/P1/P2 issues remain.

- Typography: Inter and the existing theme scale remain consistent; long Static IP location/provider strings truncate instead of widening the card.
- Spacing/layout: the new summary, map, filter and card sections follow existing radii, borders, shadows and spacing tokens; 375px has no horizontal overflow.
- Colors/tokens: VPS blue, Static IP green, warning orange and offline gray are consistently applied to summary, filter, map and card status.
- Image quality/assets: the existing flag and globe texture assets are reused; no new placeholder or generated imagery was introduced.
- Copy/content: asset labels are concise and field names match the unified domain model.
- Accessibility/behavior: filters and map labels are semantic buttons, selected states are exposed, cards have headings, and reduced-motion/offscreen globe guards remain in place.

## Comparison history

1. Initial pass found a P2 mismatch in the new VPS monthly-price compatibility field: it rendered as a third footer statistic instead of the reference’s distinct green price chip.
2. The price was moved into its own compact green chip without changing the existing card body or data flow.
3. Post-fix mobile inspection confirmed the lower card remains within 375px and preserves the reference hierarchy.

## Primary interactions tested

- All / Static IP type-filter toggle and count updates.
- Global map marker click-to-card navigation and temporary highlight.
- 375px responsive summary and both card types.
- Static IP address masking and optional risk/unlock/price presentation.
- A 200-node synthetic adapter payload preserved all 200 unique map identities; the globe keeps its existing destructor, visibility pause, resize cleanup and capped device-pixel-ratio guards.

Browser-visible errors were not observed; Vite also reported no runtime transform errors. The available in-app Browser surface did not expose a separate console-log export, so automated unit/type/build checks provide the additional error gate.

## Follow-up polish

- P3: A future real Komari installation can bind three carrier-named Ping tasks to reproduce the exact China Telecom/Unicom/Mobile rows shown in the reference; the current generic Ping module was deliberately preserved.

## Global map technology pass — 2026-09-21

- Visual reference: `/var/folders/1p/g3r0l6w55bz3_18288vjk1gm0000gn/T/codex-clipboard-e6fa1c50-f4e4-4273-b13c-7ed2cde1578a.png`.
- Replaced the plain light map container with a dark telemetry viewport using a restrained grid, scanning wash, cyan atmosphere, luminous markers and a responsive targeting reticle.
- Added bounded, animated node-to-hub globe arcs from the existing unified node data. The 72-link cap prevents large installations from turning the globe into an unbounded render workload.
- Added a compact live HUD for active nodes, rendered links and average RTT. Values are derived from the same `NetworkAssetNode[]`; no component-level fetch or provider-specific shape was introduced.
- Preserved globe rotation, zoom, marker-to-card navigation, offscreen animation pause, reduced-motion support and mobile containment.
- In-app browser inspection at the available compact desktop viewport confirmed the header, HUD, globe, legend, interaction hint and filters remain legible without horizontal overflow. The redundant legacy globe counter pills were hidden inside this composite because the HUD now carries the same state more clearly.

## Multi-carrier Ping and Static IP discoverability — 2026-09-21

- Homepage Ping bindings now allow the same VPS to belong to multiple Ping tasks. Explicit bindings filter the card to the selected tasks; automatic mode can discover every task that has samples for the node.
- The standard VPS card renders two or more tasks as separate named rows, each with independent latency and packet-loss trends. Empty configured tasks remain visible as “无样本” instead of disappearing.
- Theme management copy now recommends recognizable task names such as “上海电信 / 上海联通 / 上海移动”, which are shown verbatim together with the configured target.
- The “网络资产与 Static IP” configuration was moved out of the collapsed visual-style editor into its own top-level panel near the top of theme management.
- In-app browser verification confirmed the standalone panel is immediately visible and includes the Static IP enable switch, API URL, refresh interval, map zoom and thresholds without expanding another section.

## Orbital Command Center implementation — 2026-09-21

- Selected visual truth: `/Users/weixin/.codex/generated_images/01a0bf62-f021-7f30-b263-b8d649d9e7d1/exec-83c9d7b2-9cee-4b81-92df-a05eada4840d.png`.
- Hard content constraint: the existing production VPS Card remains below the command center without removing CPU, memory, disk, load, traffic rates/totals, quota/reset, TCP/UDP, three-carrier RT/loss, uptime, expiry, price or IP-version fields.
- The command center inspector is a secondary selected-node summary, not a replacement card.
- Monitoring snapshots retain the last successful Ping values across transient refresh gaps so permanent three-carrier rows do not collapse back to empty after data has been observed.
- Implementation evidence: Codex in-app Browser tool-native captures at the mock's 1440 × 1024 desktop viewport; the Browser surface does not expose a filesystem export path for these captures.
- Density normalization: selected source is 1440 × 1024 pixels and the implementation was inspected at a 1440 × 1024 CSS viewport at browser density 1.
- Full-view comparison: the implementation reproduces the selected composition with a narrow persistent global-status rail, a dark wide globe viewport, a fixed right-side selected-node inspector, and a full-width carrier panel immediately below. The existing Komari top status and explorer remain above by product constraint.
- Focused comparison: the globe/inspector region and the complete VPS card were separately inspected. The complete card visibly retained V4/V6, CPU, memory, disk, load, traffic rate/totals, quota/reset, all three carrier rows, TCP/UDP, expiry, uptime and price.
- Fonts/typography: existing Inter/PingFang stack retained; command-center labels use the source's compact uppercase telemetry hierarchy while body metrics remain readable.
- Spacing/layout: desktop proportions track the selected image; tablet CSS collapses the summary above the globe and hides only the duplicate inspector, never the full card.
- Colors/tokens: dark navy is limited to the map viewport; VPS blue, Static IP emerald, warning amber and carrier tones retain semantic meaning on the light mint surface.
- Image quality: production Earth day/night, bump and specular textures remain WebGL-rendered; no placeholder, CSS-drawn globe or rasterized UI was introduced.
- Copy/content: persistent freshness copy, Shanghai carrier names and exact task targets are data-backed. The globe inspector is explicitly secondary to the full node card.
- Interaction checks: globe rotate/zoom, marker selection, card highlighting and fixed three-carrier rows were visible with live fixture values. Browser error log returned no errors.
- Comparison history: first compact-browser pass showed the new structure but compressed the map; the final pass used the source-matched 1440 × 1024 viewport and confirmed the intended desktop proportions. No actionable P0/P1/P2 differences remained after normalization.

final result: passed
