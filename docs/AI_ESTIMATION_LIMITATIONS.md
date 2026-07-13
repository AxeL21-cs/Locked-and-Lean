# AI estimation limitations

Status: **Planned product policy.** The current Expo foundation does not send
photos or text to an AI system, nutrition provider, Supabase, or MCP service.

## System boundary

In the planned workflow, ChatGPT interprets the user's meal text or photo and
sends structured food candidates to Locked and Lean's remote MCP service. The
mobile app, backend, MCP server, and nutrition adapters must not call OpenAI
model APIs and must not contain an OpenAI API key.

AI interpretation is evidence for a reviewable candidate, never an
authoritative food record. The user remains responsible for reviewing the
current preview before confirmation.

## What a meal photo cannot establish

A photo alone generally cannot reveal:

- exact food weight, serving volume, or how much was eaten;
- oil, butter, sugar, salt, sauce, broth, or other absorbed additions;
- hidden fillings, layered ingredients, bones, skin, or inedible portions;
- a household recipe, cooking yield, ingredient substitutions, or preparation
  method outside the visible frame;
- exact brand, restaurant recipe, Philippine-market formulation, or label
  revision;
- whether visually similar dishes or portion terms refer to the same food;
- precise calories, protein, carbohydrates, fat, sodium, or micronutrients.

Camera angle, lens distortion, lighting, occlusion, plate size, mixed dishes,
and missing scale references can further weaken portion estimates. Multiple
photos may improve visible evidence but do not make hidden facts certain.

## Required behavior

Every estimated candidate and preview must:

- identify the likely dish/item and present plausible alternatives when
  ambiguity would materially change nutrition;
- distinguish visible evidence from assumptions;
- qualify portions using a range or familiar serving description when exact
  weight is unknown;
- state material uncertainty such as oil, sauce, recipe, edible portion, and
  market/formulation mismatch;
- include source/provenance and confidence appropriate to the evidence;
- allow corrections without silently preserving stale calculations; and
- show a complete recalculated preview after any correction.

The system must not invent a precise gram weight, oil quantity, ingredient
list, recipe, brand, or restaurant formulation merely to fill a field. When a
required fact is missing, it should ask for clarification, present qualified
alternatives, or keep the value explicitly uncertain.

## Confirmation does not make an estimate exact

The permanent-write rule is:

1. **Interpret** — produce structured candidates and uncertainty.
2. **Verify** — match nutrition data and show the complete current preview.
3. **Log** — accept only explicit confirmation of that exact preview revision.

Preview creation and revision cannot create diary entries. A correction creates
a new revision and requires confirmation again. Confirmation records the
reviewed assumptions and provenance; it does not convert an estimate into a
measured fact.

## Practical ways to improve an estimate

Users can provide a package nutrition label, brand and product name, weighed
quantity, restaurant and menu item, recipe ingredients/yield, cooking method,
or a familiar serving reference such as cup, piece, ladle, sachet, or plate.
These details can narrow uncertainty, but label accuracy, recipe variation, and
serving differences still apply.

For clinical nutrition, allergies, pregnancy, eating-disorder care, diabetes,
kidney disease, or other medical decisions, users should not rely on a photo
estimate as professional advice or as a guarantee that an ingredient is absent.
