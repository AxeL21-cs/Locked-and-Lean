export interface FoodAliasMatch {
  kind: "dish" | "chain" | "restaurant_item";
  canonicalId: string;
  canonicalName: string;
  matchedAlias: string;
  chainId?: string;
}

const DISH_ALIASES = {
  adobo: ["adobo"],
  chicken_adobo: ["chicken adobo", "adobong manok"],
  pork_adobo: ["pork adobo", "adobong baboy"],
  sinigang: ["sinigang"],
  tinola: ["tinola", "tinolang manok"],
  kare_kare: ["kare-kare", "kare kare"],
  pinakbet: ["pinakbet", "pakbet"],
  dinuguan: ["dinuguan"],
  laing: ["laing"],
  bicol_express: ["bicol express"],
  sisig: ["sisig"],
  tapsilog: ["tapsilog", "tapa sinangag itlog"],
  longsilog: ["longsilog", "longganisa sinangag itlog"],
  tocilog: ["tocilog", "tocino sinangag itlog"],
  bangsilog: ["bangsilog", "bangus sinangag itlog"],
  arroz_caldo: ["arroz caldo"],
  lugaw: ["lugaw"],
  champorado: ["champorado"],
  pancit_canton: ["pancit canton", "pansit canton"],
  pancit_bihon: ["pancit bihon", "pansit bihon", "bihon"],
  palabok: ["palabok", "pancit palabok", "pansit palabok"],
  lumpiang_shanghai: ["lumpiang shanghai", "lumpia shanghai", "shanghai"],
  lumpiang_sariwa: ["lumpiang sariwa", "fresh lumpia"],
  turon: ["turon"],
  banana_cue: ["banana cue", "banana q", "bananacue"],
  kamote_cue: ["kamote cue", "kamote q", "camote cue"],
  kwek_kwek: ["kwek-kwek", "kwek kwek"],
  fish_ball: ["fish ball", "fishball", "fish balls"],
  isaw: ["isaw"],
  pandesal: ["pandesal", "pan de sal"],
  ensaymada: ["ensaymada", "ensaimada"],
  puto: ["puto"],
  kutsinta: ["kutsinta", "cuchinta"],
  bibingka: ["bibingka"],
  suman: ["suman"],
  halo_halo: ["halo-halo", "halo halo"],
  leche_flan: ["leche flan"],
  ube_halaya: ["ube halaya", "halayang ube"],
  taho: ["taho"],
} as const;

export const PHILIPPINE_DISH_ALIASES: Readonly<
  Record<string, readonly string[]>
> = DISH_ALIASES;

const canonicalDishName = (id: string): string => id.replaceAll("_", " ");

export function normalizeAliasKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-PH")
    .replace(/[’']/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveDishAlias(value: string): FoodAliasMatch | null {
  const key = normalizeAliasKey(value);

  for (const [canonicalId, aliases] of Object.entries(DISH_ALIASES)) {
    const matchedAlias = aliases.find(
      (alias) => normalizeAliasKey(alias) === key,
    );
    if (matchedAlias) {
      return {
        kind: "dish",
        canonicalId,
        canonicalName: canonicalDishName(canonicalId),
        matchedAlias,
      };
    }
  }

  return null;
}
