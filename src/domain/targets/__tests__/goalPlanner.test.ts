import { calculateBmi, deriveWeightGoal } from "../goalPlanner";

describe("goal planner display helpers", () => {
  it("calculates a one-decimal BMI for valid metric inputs", () => {
    expect(calculateBmi(170, 70)).toBe(24.2);
  });

  it("returns null instead of displaying an invalid BMI", () => {
    expect(calculateBmi(0, 70)).toBeNull();
    expect(calculateBmi(170, Number.NaN)).toBeNull();
  });

  it("derives direction from current and target weight", () => {
    expect(deriveWeightGoal(70, 65)).toBe("lose");
    expect(deriveWeightGoal(70, 75)).toBe("gain");
    expect(deriveWeightGoal(70, 70)).toBe("maintain");
  });

  it("treats tiny rounding differences as maintenance", () => {
    expect(deriveWeightGoal(70, 69.96)).toBe("maintain");
    expect(deriveWeightGoal(70, 70.04)).toBe("maintain");
  });
});
