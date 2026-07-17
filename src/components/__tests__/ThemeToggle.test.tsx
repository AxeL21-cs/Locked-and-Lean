import { fireEvent, render } from "@testing-library/react-native";

import { resolveAppTheme, useAppTheme } from "../../design-system/theme";
import { ThemeToggle } from "../ThemeToggle";

const mockSelectionAsync = jest.fn(() => Promise.resolve());

jest.mock("expo-haptics", () => ({
  selectionAsync: () => mockSelectionAsync(),
}));
jest.mock("../../design-system/theme", () => {
  const actual = jest.requireActual("../../design-system/theme");
  return { ...actual, useAppTheme: jest.fn() };
});

const mockedUseAppTheme = useAppTheme as jest.MockedFunction<
  typeof useAppTheme
>;

function mockTheme(colorScheme: "light" | "dark") {
  const toggleDarkMode = jest.fn();
  mockedUseAppTheme.mockReturnValue({
    ...resolveAppTheme(colorScheme),
    preference: colorScheme,
    setPreference: jest.fn(),
    toggleDarkMode,
  });
  return toggleDarkMode;
}

describe("ThemeToggle", () => {
  beforeEach(() => mockSelectionAsync.mockClear());

  it("exposes a 48dp switch and toggles with haptic feedback", async () => {
    const toggleDarkMode = mockTheme("light");
    const view = await render(<ThemeToggle />);
    const toggle = view.getByRole("switch", { name: "Dark mode" });

    expect(toggle.props.accessibilityState).toEqual({ checked: false });
    expect(toggle.props.accessibilityHint).toBe(
      "Switches the app to dark appearance",
    );
    expect(toggle).toHaveStyle({
      height: 48,
      minHeight: 48,
      minWidth: 48,
      width: 48,
    });

    fireEvent.press(toggle);

    expect(toggleDarkMode).toHaveBeenCalledTimes(1);
    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
  });

  it("announces the checked dark state and opposite action", async () => {
    mockTheme("dark");
    const view = await render(<ThemeToggle />);
    const toggle = view.getByRole("switch", { name: "Dark mode" });

    expect(toggle.props.accessibilityState).toEqual({ checked: true });
    expect(toggle.props.accessibilityHint).toBe(
      "Switches the app to light appearance",
    );
  });
});
