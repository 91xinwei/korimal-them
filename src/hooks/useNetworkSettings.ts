import { useMemo } from "react";
import { normalizeNetworkAssetSettings } from "@/config/network";
import { usePublicConfig } from "@/hooks/usePublicConfig";

export function useNetworkSettings() {
  const { data: config } = usePublicConfig();
  return useMemo(
    () => normalizeNetworkAssetSettings(config?.theme_settings),
    [config?.theme_settings],
  );
}
