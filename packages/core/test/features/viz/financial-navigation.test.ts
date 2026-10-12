import {
  calendarAxisTicks,
  calendarMonthsBefore,
  latestLogicalRange,
  shiftLogicalRange,
  utcPeriodRange,
  zoomLogicalRange,
} from "../../../../scenarios/src/learning/composition/financial-navigation.js";
import { expect, it } from "vitest";

it("selects only supplied UTC observations and clamps calendar months", () => {
  const times = [
    Date.UTC(2026, 1, 27, 16),
    Date.UTC(2026, 2, 2, 16),
    Date.UTC(2026, 2, 31, 16),
  ];
  expect(
    utcPeriodRange(times, {
      startTime: Date.UTC(2026, 1, 28),
      endTime: Date.UTC(2026, 2, 2, 16),
    }),
  ).toEqual([0.5, 1.5]);
  expect(
    utcPeriodRange(times, {
      startTime: Date.UTC(2026, 1, 28),
      endTime: Date.UTC(2026, 1, 28, 23),
    }),
  ).toBeUndefined();
  expect(calendarMonthsBefore(Date.UTC(2026, 2, 31, 16), 1)).toBe(
    Date.UTC(2026, 1, 28, 16),
  );
  expect(calendarMonthsBefore(Date.UTC(2024, 2, 31, 16), 1)).toBe(
    Date.UTC(2024, 1, 29, 16),
  );
});

it("keeps slot navigation bounded with a two-slot minimum", () => {
  const bounds = [-0.5, 9.5] as const;
  expect(
    shiftLogicalRange([6, 9.5], { delta: 4, bounds, minimumSpan: 2 }),
  ).toEqual([6, 9.5]);
  expect(
    zoomLogicalRange([4, 6], { factor: 0.25, bounds, minimumSpan: 2 }),
  ).toEqual([4, 6]);
  expect(latestLogicalRange([1, 4], { bounds, minimumSpan: 2 })).toEqual([
    6.5, 9.5,
  ]);
});

it("adapts calendar ticks to visible months, weeks, and days without inventing observations", () => {
  const times = Array.from({ length: 100 }, (_, i) =>
    Date.UTC(2026, 0, i + 1, 16),
  ).filter((time) => ![0, 6].includes(new Date(time).getUTCDay()));
  const months = calendarAxisTicks(times, {
    logicalRange: [-0.5, times.length - 0.5],
    width: 700,
  });
  expect(months.format(months.values[1]!)).toBe("Feb 2026");
  const weeks = calendarAxisTicks(times, {
    logicalRange: [20.5, 40.5],
    width: 700,
  });
  expect(weeks.values.length).toBeGreaterThan(2);
  const days = calendarAxisTicks(times, {
    logicalRange: [30.5, 35.5],
    width: 700,
  });
  expect(days.values).toEqual(times.slice(31, 36));
  for (const result of [months, weeks, days])
    expect(result.values.every((time) => times.includes(time))).toBe(true);
  const narrow = calendarAxisTicks(times, {
    logicalRange: [20.5, 40.5],
    width: 180,
  });
  expect(narrow.values.length).toBeLessThanOrEqual(2);
  expect(
    narrow.values.every(
      (time) => times.indexOf(time) >= 21 && times.indexOf(time) <= 40,
    ),
  ).toBe(true);
});
