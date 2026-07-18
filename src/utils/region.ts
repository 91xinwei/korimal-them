const REGIONAL_INDICATOR_MIN = 0x1f1e6;
const REGIONAL_INDICATOR_MAX = 0x1f1ff;
const ASCII_ALPHA_START = 0x41;

const SPECIAL_REGION_CODES: Record<string, string> = {
  "🇺🇳": "UN",
  "🌐": "UN",
  "中国": "CN",
  "香港": "HK",
  "台湾": "TW",
  "日本": "JP",
  "韩国": "KR",
  "新加坡": "SG",
  "美国": "US",
  "英国": "GB",
  "德国": "DE",
  "法国": "FR",
  "加拿大": "CA",
  "澳大利亚": "AU",
  "俄罗斯": "RU",
  "印度": "IN",
  "荷兰": "NL",
};

const REGION_COORDINATES: Record<string, [number, number]> = {
  AR: [-64, -34], AU: [134, -25], AT: [14, 47.5], BE: [4.6, 50.8], BR: [-52, -10],
  CA: [-107, 56], CH: [8.2, 46.8], CL: [-71, -33], CN: [104, 35], CO: [-74, 4],
  CZ: [15.5, 49.8], DE: [10.4, 51], DK: [9.5, 56], ES: [-3.7, 40.4], FI: [26, 64],
  FR: [2.2, 46.2], GB: [-3, 55], GR: [22, 39], HK: [114.2, 22.3], HU: [19.5, 47],
  ID: [118, -2], IE: [-8, 53], IL: [35, 31.5], IN: [79, 22], IT: [12.5, 42.8],
  JP: [138, 36], KR: [128, 36], LU: [6.1, 49.8], MX: [-102, 23], MY: [102, 4],
  NL: [5.4, 52.2], NO: [8.5, 61], NZ: [172, -41], PH: [122, 13], PL: [19, 52],
  PT: [-8, 39.5], RO: [25, 46], RU: [100, 60], SA: [45, 24], SE: [16, 62],
  SG: [103.8, 1.35], TH: [101, 15], TR: [35, 39], TW: [121, 23.7], UA: [31, 49],
  US: [-98, 39], VN: [108, 16], ZA: [24, -29], AE: [54, 24], BG: [25.5, 42.7],
};

function countryCodeFromEmoji(input: string): string | null {
  const chars = Array.from(input);
  if (chars.length !== 2) return null;
  const first = chars[0].codePointAt(0) ?? 0;
  const second = chars[1].codePointAt(0) ?? 0;
  if (
    first < REGIONAL_INDICATOR_MIN || first > REGIONAL_INDICATOR_MAX ||
    second < REGIONAL_INDICATOR_MIN || second > REGIONAL_INDICATOR_MAX
  ) {
    return null;
  }
  return String.fromCodePoint(
    first - REGIONAL_INDICATOR_MIN + ASCII_ALPHA_START,
    second - REGIONAL_INDICATOR_MIN + ASCII_ALPHA_START,
  );
}

export function resolveRegionCode(region: string | null | undefined): string {
  const value = region?.trim() ?? "";
  if (!value) return "UN";
  const emojiCode = countryCodeFromEmoji(value);
  if (emojiCode) return emojiCode;
  if (/^[a-z]{2}$/i.test(value)) return value.toUpperCase();
  return SPECIAL_REGION_CODES[value] ?? "UN";
}

export function getRegionCoordinates(region: string | null | undefined) {
  const code = resolveRegionCode(region);
  const coordinate = REGION_COORDINATES[code];
  if (!coordinate) return null;
  const [longitude, latitude] = coordinate;
  return {
    code,
    longitude,
    latitude,
    x: ((longitude + 180) / 360) * 100,
    y: ((90 - latitude) / 180) * 100,
  };
}

export function getRegionDisplayName(region: string | null | undefined): string {
  const value = region?.trim();
  if (!value) return "未知地区";
  const code = resolveRegionCode(value);
  if (code === "UN") return value;
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(code) ?? value;
  } catch {
    return value;
  }
}
