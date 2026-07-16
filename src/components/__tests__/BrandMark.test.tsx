import { render } from "@testing-library/react-native";

import { PRODUCT } from "../../design-system/product";
import { BrandMark } from "../BrandMark";

describe("BrandMark", () => {
  it("uses the configurable product name in its default accessibility label", async () => {
    const view = await render(<BrandMark />);

    expect(
      view.getByRole("image", { name: `${PRODUCT.name} logo` }),
    ).toBeTruthy();
  });

  it("can render a scalable wordmark without duplicating image semantics", async () => {
    const view = await render(<BrandMark showWordmark size={64} />);

    expect(view.getByText(PRODUCT.name)).toBeTruthy();
    expect(view.getAllByRole("image")).toHaveLength(1);
  });

  it("can be decorative on an already-labelled launch surface", async () => {
    const view = await render(<BrandMark decorative />);

    expect(view.queryByRole("image")).toBeNull();
  });
});
