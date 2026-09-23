import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adaptKomariNode } from "@/adapters/komari-node-adapter";
import type { NetworkAssetSettings } from "@/config/network";
import { getPingMiniSnapshot } from "@/hooks/usePingMini";
import { HttpStaticIpProvider, MockStaticIpProvider } from "@/services/static-ip";
import type { NodeDisplay } from "@/types/komari";
import { fetchIpQualityRecords } from "@/services/ip-quality";

export function useNetworkAssets(vpsDisplays: NodeDisplay[], settings: NetworkAssetSettings) {
  const staticProvider = useMemo(
    () => new HttpStaticIpProvider(settings.staticIpApiUrl, settings.thresholds),
    [settings.staticIpApiUrl, settings.thresholds],
  );
  const mockProvider = useMemo(
    () => new MockStaticIpProvider(settings.thresholds),
    [settings.thresholds],
  );

  const staticQuery = useQuery({
    queryKey: ["static-ips", settings.staticIpApiUrl, settings.thresholds],
    enabled: settings.showStaticIps,
    queryFn: async ({ signal }) => {
      try {
        return await staticProvider.list(signal);
      } catch (error) {
        if (import.meta.env.DEV) return mockProvider.list(signal);
        throw error;
      }
    },
    refetchInterval: settings.staticRefreshInterval,
    staleTime: Math.min(settings.staticRefreshInterval / 2, 30_000),
    retry: 1,
  });

  const qualityQuery = useQuery({
    queryKey: ["ip-quality", settings.ipQualityApiUrl],
    enabled: settings.showRiskScore,
    queryFn: async ({ signal }) => {
      try {
        return await fetchIpQualityRecords(settings.ipQualityApiUrl, signal);
      } catch (error) {
        if (import.meta.env.DEV) return fetchIpQualityRecords("/mock/ip-quality.json", signal);
        throw error;
      }
    },
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const qualityByNodeId = useMemo(
    () => new Map((qualityQuery.data ?? []).map((record) => [record.id, record.quality])),
    [qualityQuery.data],
  );

  const vpsNodes = useMemo(
    () =>
      vpsDisplays.map((node) => {
        const ping = getPingMiniSnapshot(node.uuid);
        const adapted = adaptKomariNode(
          node,
          { latency: ping.lastValue, packetLoss: ping.loss },
          settings.thresholds,
        );
        return { ...adapted, quality: qualityByNodeId.get(node.uuid) };
      }),
    [qualityByNodeId, settings.thresholds, vpsDisplays],
  );
  const staticNodes = settings.showStaticIps ? (staticQuery.data ?? []) : [];
  const allNodes = useMemo(
    () => [...vpsNodes, ...staticNodes],
    [staticNodes, vpsNodes],
  );

  return {
    vpsNodes,
    staticNodes,
    allNodes,
    staticLoading: settings.showStaticIps && staticQuery.isPending,
    staticFetching: settings.showStaticIps && staticQuery.isFetching,
    staticError: settings.showStaticIps ? staticQuery.error : null,
    retryStatic: staticQuery.refetch,
  };
}
