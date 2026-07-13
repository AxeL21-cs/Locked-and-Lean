import { fireEvent, render } from "@testing-library/react-native";

import { AddActionList } from "../AddActionList";

describe("AddActionList", () => {
  it.each([
    "Scan Barcode",
    "Manual Food Entry",
    "Saved Foods",
    "Log with ChatGPT",
  ])("exposes %s as an accessible action", async (label) => {
    const view = await render(<AddActionList onSelect={jest.fn()} />);
    expect(view.getByRole("button", { name: new RegExp(label) })).toBeTruthy();
  });

  it("reports selection without pretending to call an integration", async () => {
    const select = jest.fn();
    const view = await render(<AddActionList onSelect={select} />);
    fireEvent.press(view.getByRole("button", { name: /Scan Barcode/ }));
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Scan Barcode" }),
    );
  });
});
