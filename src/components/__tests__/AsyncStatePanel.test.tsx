import { fireEvent, render } from "@testing-library/react-native";

import { AsyncStatePanel } from "../AsyncStatePanel";

describe("AsyncStatePanel", () => {
  it("exposes error text and a working retry affordance without relying on color", async () => {
    const retry = jest.fn();
    const view = await render(
      <AsyncStatePanel
        kind="error"
        title="Could not sync"
        message="No data changed."
        actionLabel="Try again"
        onAction={retry}
      />,
    );

    expect(view.getByText("ERROR")).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: /Try again/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("labels the loading state in text", async () => {
    const view = await render(
      <AsyncStatePanel
        kind="loading"
        title="Loading record"
        message="Please wait."
      />,
    );
    expect(view.getByText("LOADING")).toBeTruthy();
    expect(view.getByLabelText("Loading")).toBeTruthy();
  });
});
