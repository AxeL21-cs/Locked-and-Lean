import { TAB_ITEMS } from "../tabs";

it("keeps the required bottom-tab order", () => {
  expect(TAB_ITEMS.map((item) => item.label)).toEqual([
    "Today",
    "Calendar",
    "Add",
    "Progress",
    "Profile",
  ]);
});
