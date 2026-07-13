import { normalizeAliasKey, type FoodAliasMatch } from "./aliases";

export interface FastFoodChainDefinition {
  id: string;
  name: string;
  aliases: readonly string[];
}

export const PHILIPPINE_FAST_FOOD_CHAINS: readonly FastFoodChainDefinition[] = [
  { id: "jollibee", name: "Jollibee", aliases: ["Jollibee"] },
  {
    id: "mcdonalds_ph",
    name: "McDonald's Philippines",
    aliases: ["McDonald's Philippines", "McDonalds PH", "McDo"],
  },
  { id: "mang_inasal", name: "Mang Inasal", aliases: ["Mang Inasal"] },
  { id: "chowking", name: "Chowking", aliases: ["Chowking"] },
  { id: "greenwich", name: "Greenwich", aliases: ["Greenwich"] },
  {
    id: "kfc_ph",
    name: "KFC Philippines",
    aliases: ["KFC Philippines", "KFC"],
  },
  {
    id: "burger_king_ph",
    name: "Burger King Philippines",
    aliases: ["Burger King Philippines", "Burger King"],
  },
  { id: "bonchon_ph", name: "Bonchon Philippines", aliases: ["Bonchon"] },
  { id: "tokyo_tokyo", name: "Tokyo Tokyo", aliases: ["Tokyo Tokyo"] },
  { id: "popeyes_ph", name: "Popeyes Philippines", aliases: ["Popeyes"] },
  { id: "shakeys_ph", name: "Shakey's Philippines", aliases: ["Shakey's"] },
  { id: "pizza_hut_ph", name: "Pizza Hut Philippines", aliases: ["Pizza Hut"] },
  { id: "yellow_cab", name: "Yellow Cab", aliases: ["Yellow Cab"] },
  { id: "potato_corner", name: "Potato Corner", aliases: ["Potato Corner"] },
  { id: "goldilocks", name: "Goldilocks", aliases: ["Goldilocks"] },
  { id: "red_ribbon", name: "Red Ribbon", aliases: ["Red Ribbon"] },
  { id: "dunkin_ph", name: "Dunkin Philippines", aliases: ["Dunkin"] },
  {
    id: "krispy_kreme_ph",
    name: "Krispy Kreme Philippines",
    aliases: ["Krispy Kreme"],
  },
  { id: "starbucks_ph", name: "Starbucks Philippines", aliases: ["Starbucks"] },
  {
    id: "bos_coffee",
    name: "Bo's Coffee",
    aliases: ["Bo's Coffee", "Bos Coffee"],
  },
  {
    id: "cbtl_ph",
    name: "Coffee Bean and Tea Leaf Philippines",
    aliases: ["Coffee Bean and Tea Leaf", "CBTL"],
  },
  {
    id: "seven_eleven_ph",
    name: "7-Eleven Philippines",
    aliases: ["7-Eleven"],
  },
  { id: "uncle_johns", name: "Uncle John's", aliases: ["Uncle John's"] },
];

interface RestaurantItemAlias {
  canonicalId: string;
  canonicalName: string;
  chainId: string;
  aliases: readonly string[];
}

const RESTAURANT_ITEM_ALIASES: readonly RestaurantItemAlias[] = [
  {
    canonicalId: "chickenjoy",
    canonicalName: "Chickenjoy",
    chainId: "jollibee",
    aliases: ["Chickenjoy", "Chicken Joy"],
  },
  {
    canonicalId: "yumburger",
    canonicalName: "Yumburger",
    chainId: "jollibee",
    aliases: ["Yumburger", "Yum Burger"],
  },
  {
    canonicalId: "jolly_spaghetti",
    canonicalName: "Jolly Spaghetti",
    chainId: "jollibee",
    aliases: ["Jolly Spaghetti", "Jollibee spaghetti"],
  },
  {
    canonicalId: "burger_steak",
    canonicalName: "Burger Steak",
    chainId: "jollibee",
    aliases: ["Burger Steak"],
  },
  {
    canonicalId: "chicken_mcdo",
    canonicalName: "Chicken McDo",
    chainId: "mcdonalds_ph",
    aliases: ["Chicken McDo"],
  },
  {
    canonicalId: "mcspaghetti",
    canonicalName: "McSpaghetti",
    chainId: "mcdonalds_ph",
    aliases: ["McSpaghetti", "Mc Spaghetti"],
  },
  {
    canonicalId: "chicken_inasal",
    canonicalName: "Chicken Inasal",
    chainId: "mang_inasal",
    aliases: ["Inasal", "Paa", "Pecho"],
  },
  {
    canonicalId: "unlimited_rice",
    canonicalName: "Unlimited Rice",
    chainId: "mang_inasal",
    aliases: ["Unli-rice", "Unli rice"],
  },
  {
    canonicalId: "chao_fan",
    canonicalName: "Chao Fan",
    chainId: "chowking",
    aliases: ["Chao Fan"],
  },
  {
    canonicalId: "siomai_chao_fan",
    canonicalName: "Siomai Chao Fan",
    chainId: "chowking",
    aliases: ["Siomai Chao Fan"],
  },
  {
    canonicalId: "hotshots",
    canonicalName: "Hotshots",
    chainId: "kfc_ph",
    aliases: ["Hotshots"],
  },
  {
    canonicalId: "famous_bowl",
    canonicalName: "Famous Bowl",
    chainId: "kfc_ph",
    aliases: ["Famous Bowl"],
  },
  {
    canonicalId: "whopper",
    canonicalName: "Whopper",
    chainId: "burger_king_ph",
    aliases: ["Whopper"],
  },
];

export function resolveFastFoodAlias(value: string): FoodAliasMatch | null {
  const key = normalizeAliasKey(value);
  for (const chain of PHILIPPINE_FAST_FOOD_CHAINS) {
    const matchedAlias = chain.aliases.find(
      (alias) => normalizeAliasKey(alias) === key,
    );
    if (matchedAlias) {
      return {
        kind: "chain",
        canonicalId: chain.id,
        canonicalName: chain.name,
        matchedAlias,
      };
    }
  }
  for (const item of RESTAURANT_ITEM_ALIASES) {
    const matchedAlias = item.aliases.find(
      (alias) => normalizeAliasKey(alias) === key,
    );
    if (matchedAlias) {
      return {
        kind: "restaurant_item",
        canonicalId: item.canonicalId,
        canonicalName: item.canonicalName,
        matchedAlias,
        chainId: item.chainId,
      };
    }
  }
  return null;
}

export interface EditableComboComponentFixture {
  id: string;
  name: string;
  role: "main" | "side" | "drink" | "sauce";
  quantity: number;
  unit: string;
  editable: true;
  removable: boolean;
  requiresServingAssumption: boolean;
  nutrition: null;
}

export interface EditableComboFixture {
  id: string;
  fixtureLabel: string;
  fixtureOnly: true;
  chainId: string;
  market: "PH";
  menuVersion: "fixture-unversioned";
  nutritionAvailability: "not_provided";
  components: readonly EditableComboComponentFixture[];
}

export const MOCK_EDITABLE_COMBO_FIXTURES: readonly EditableComboFixture[] = [
  {
    id: "mock-jollibee-chickenjoy-rice-meal",
    fixtureLabel: "MOCK - editable Chickenjoy rice meal structure",
    fixtureOnly: true,
    chainId: "jollibee",
    market: "PH",
    menuVersion: "fixture-unversioned",
    nutritionAvailability: "not_provided",
    components: [
      {
        id: "main",
        name: "Chickenjoy",
        role: "main",
        quantity: 1,
        unit: "piece",
        editable: true,
        removable: false,
        requiresServingAssumption: true,
        nutrition: null,
      },
      {
        id: "rice",
        name: "Rice",
        role: "side",
        quantity: 1,
        unit: "rice serving",
        editable: true,
        removable: true,
        requiresServingAssumption: true,
        nutrition: null,
      },
      {
        id: "gravy",
        name: "Gravy",
        role: "sauce",
        quantity: 1,
        unit: "serving",
        editable: true,
        removable: true,
        requiresServingAssumption: true,
        nutrition: null,
      },
    ],
  },
];

export function cloneEditableComboFixture(
  id: string,
): EditableComboFixture | null {
  const fixture = MOCK_EDITABLE_COMBO_FIXTURES.find(
    (candidate) => candidate.id === id,
  );
  return fixture ? JSON.parse(JSON.stringify(fixture)) : null;
}
