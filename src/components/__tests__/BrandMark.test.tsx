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

  it("optically scales the supplied tile while preserving its square frame", async () => {
    const view = await render(
      <BrandMark
        artworkScale={1.25}
        showWordmark
        size={40}
        wordmarkSize={18}
      />,
    );
    const artwork = view.getByTestId("brand-artwork");
    const wordmark = view.getByText(PRODUCT.name);

    expect(artwork.props.resizeMode).toBe("contain");
    expect(artwork.props.style).toMatchObject({
      height: 50,
      left: -5,
      top: -5,
      width: 50,
    });
    expect(wordmark.props.allowFontScaling).toBe(true);
    expect(wordmark).toHaveStyle({ fontSize: 18, lineHeight: 22.5 });
  });
});
