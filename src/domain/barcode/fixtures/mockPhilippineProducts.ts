import type { BarcodeProductCandidate } from "../types";

const MOCK_LABEL = "MOCK FIXTURE ONLY - not live product or nutrition data.";

export const MOCK_PHILIPPINE_BARCODE_PRODUCTS: readonly BarcodeProductCandidate[] =
  [
    {
      id: "mock-private-saved-calamansi",
      gtin: "4006381333931",
      canonicalName: "QA Calamansi Drink (MOCK)",
      brandName: "Fixture Foods PH",
      sourceKind: "user_confirmed_saved_food",
      source: {
        providerId: "mock-private-library",
        providerDisplayName: "MOCK private saved foods",
        providerRecordId: "mock-saved-001",
        observedAt: "2026-07-01T00:00:00.000Z",
        attribution: "Synthetic QA fixture",
        license: { status: "private_user_data", name: null, url: null },
      },
      market: "PH",
      marketEvidence: ["mock package label country: PH"],
      nutrition: {
        calories: 80,
        proteinG: null,
        carbohydratesG: 20,
        fatG: null,
        serving: {
          quantity: 1,
          term: "bottle",
          measurableAmount: {
            quantity: 250,
            unit: "ml",
            sourceDescription: "synthetic mock label",
          },
        },
      },
      fixtureOnly: true,
      fixtureLabel: MOCK_LABEL,
    },
    {
      id: "mock-open-ph-calamansi",
      gtin: "4006381333931",
      canonicalName: "QA Calamansi Beverage (MOCK)",
      brandName: "Fixture Foods PH",
      sourceKind: "open_food_facts_ph_market",
      source: {
        providerId: "mock-open-provider",
        providerDisplayName: "MOCK open provider",
        providerRecordId: "mock-open-001",
        observedAt: "2026-06-15T00:00:00.000Z",
        attribution: "Synthetic QA fixture; not an Open Food Facts record",
        license: {
          status: "open_licensed",
          name: "Synthetic fixture license",
          url: null,
        },
      },
      market: "PH",
      marketEvidence: ["mock provider market: PH"],
      nutrition: {
        calories: 75,
        proteinG: 0,
        carbohydratesG: 18,
        fatG: 0,
        serving: {
          quantity: 1,
          term: "bottle",
          measurableAmount: {
            quantity: 250,
            unit: "ml",
            sourceDescription: "synthetic mock provider serving",
          },
        },
      },
      fixtureOnly: true,
      fixtureLabel: MOCK_LABEL,
    },
    {
      id: "mock-foreign-calamansi",
      gtin: "4006381333931",
      canonicalName: "QA Citrus Beverage Foreign Variant (MOCK)",
      brandName: "Fixture Foods Global",
      sourceKind: "open_food_facts_ph_market",
      source: {
        providerId: "mock-open-provider",
        providerDisplayName: "MOCK open provider",
        providerRecordId: "mock-open-foreign-001",
        observedAt: "2025-01-01T00:00:00.000Z",
        attribution: "Synthetic QA fixture",
        license: {
          status: "open_licensed",
          name: "Synthetic fixture license",
          url: null,
        },
      },
      market: "foreign",
      marketEvidence: ["mock country of sale: US"],
      nutrition: {
        calories: 95,
        proteinG: 0,
        carbohydratesG: 24,
        fatG: 0,
        serving: {
          quantity: 1,
          term: "bottle",
          measurableAmount: {
            quantity: 355,
            unit: "ml",
            sourceDescription: "synthetic foreign mock label",
          },
        },
      },
      fixtureOnly: true,
      fixtureLabel: MOCK_LABEL,
    },
  ] as const;
