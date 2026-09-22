import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adaptKomariNode } from "@/adapters/komari-node-adapter";
import type { NetworkAssetSettings } from "@/config/network";
import { getPingMiniSnapshot } from "@/hooks/usePingMini";
import { HttpStaticIpProvider, MockStaticIpProvider } from "@/services/static-ip";
import type { NodeDisplay } from "@/types/komari";

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

  const vpsNodes = useMemo(
    () =>
      vpsDisplays.map((node) => {
        const ping = getPingMiniSnapshot(node.uuid);
        return adaptKomariNode(
          node,
          { latency: ping.lastValue, packetLoss: ping.loss },
          settings.thresholds,
        );
      }),
    [settings.thresholds, vpsDisplays],
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
