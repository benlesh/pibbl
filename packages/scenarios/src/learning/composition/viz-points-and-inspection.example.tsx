import {
  Absolute,
  Circle,
  Group,
  Line,
  Rectangle,
  Text,
  batch,
  crc,
  useLayoutBox,
  useSignal,
  type CRCController,
  type BoxStyle,
  type LayoutItemStyle,
  type WritableSignal,
} from "@crc/core";
import {
  Axis,
  PointSeries,
  PlotSeries,
  Scale,
  nearestPoint,
  useScale,
} from "@crc/viz";

type Row = {
  id: string;
  x: number | null;
  y: number | null;
  label: string;
  color: string;
  island?: string;
  year?: number;
};
type PanelSnapshot = {
  width: number;
  height: number;
  anchors: readonly { id: string; x: number; y: number }[];
};
interface Fixture {
  xDomain?: readonly [number, number];
  yDomain?: readonly [number, number];
  rows?: WritableSignal<readonly Row[]>;
  selected?: WritableSignal<string>;
  clicks?: WritableSignal<number>;
  onPanel?: (index: number, panel: PanelSnapshot) => void;
  onMark?: (id: string, count: number) => void;
  onReading?: (selected: string, clicks: number) => void;
}
// Static Palmer Penguins snapshot, downloaded 2026-09-28 (no runtime requests).
// Source: https://github.com/allisonhorst/palmerpenguins/blob/main/inst/extdata/penguins.csv
// Dataset and CC0 license: https://allisonhorst.github.io/palmerpenguins/
// Collected by Kristen Gorman and Palmer Station Antarctica LTER, 2007–2009.
// Package: Horst, Hill & Gorman (2020), doi:10.5281/zenodo.3960218.
// Original CSV SHA-256: f204db2c753b0937caac3cb35258562c14f073e4bbc76be24b4c51ce22767a93
// Columns below: species, flipper length (mm), body mass (g), island, year.
// All 344 source rows retain source order and exact values; NA becomes null.
// IDs identify snapshot row numbers, not biological individual identifiers.
const measurements: readonly [
  string,
  number | null,
  number | null,
  string,
  number,
][] = [
  ["Adelie", 181, 3750, "Torgersen", 2007],
  ["Adelie", 186, 3800, "Torgersen", 2007],
  ["Adelie", 195, 3250, "Torgersen", 2007],
  ["Adelie", null, null, "Torgersen", 2007],
  ["Adelie", 193, 3450, "Torgersen", 2007],
  ["Adelie", 190, 3650, "Torgersen", 2007],
  ["Adelie", 181, 3625, "Torgersen", 2007],
  ["Adelie", 195, 4675, "Torgersen", 2007],
  ["Adelie", 193, 3475, "Torgersen", 2007],
  ["Adelie", 190, 4250, "Torgersen", 2007],
  ["Adelie", 186, 3300, "Torgersen", 2007],
  ["Adelie", 180, 3700, "Torgersen", 2007],
  ["Adelie", 182, 3200, "Torgersen", 2007],
  ["Adelie", 191, 3800, "Torgersen", 2007],
  ["Adelie", 198, 4400, "Torgersen", 2007],
  ["Adelie", 185, 3700, "Torgersen", 2007],
  ["Adelie", 195, 3450, "Torgersen", 2007],
  ["Adelie", 197, 4500, "Torgersen", 2007],
  ["Adelie", 184, 3325, "Torgersen", 2007],
  ["Adelie", 194, 4200, "Torgersen", 2007],
  ["Adelie", 174, 3400, "Biscoe", 2007],
  ["Adelie", 180, 3600, "Biscoe", 2007],
  ["Adelie", 189, 3800, "Biscoe", 2007],
  ["Adelie", 185, 3950, "Biscoe", 2007],
  ["Adelie", 180, 3800, "Biscoe", 2007],
  ["Adelie", 187, 3800, "Biscoe", 2007],
  ["Adelie", 183, 3550, "Biscoe", 2007],
  ["Adelie", 187, 3200, "Biscoe", 2007],
  ["Adelie", 172, 3150, "Biscoe", 2007],
  ["Adelie", 180, 3950, "Biscoe", 2007],
  ["Adelie", 178, 3250, "Dream", 2007],
  ["Adelie", 178, 3900, "Dream", 2007],
  ["Adelie", 188, 3300, "Dream", 2007],
  ["Adelie", 184, 3900, "Dream", 2007],
  ["Adelie", 195, 3325, "Dream", 2007],
  ["Adelie", 196, 4150, "Dream", 2007],
  ["Adelie", 190, 3950, "Dream", 2007],
  ["Adelie", 180, 3550, "Dream", 2007],
  ["Adelie", 181, 3300, "Dream", 2007],
  ["Adelie", 184, 4650, "Dream", 2007],
  ["Adelie", 182, 3150, "Dream", 2007],
  ["Adelie", 195, 3900, "Dream", 2007],
  ["Adelie", 186, 3100, "Dream", 2007],
  ["Adelie", 196, 4400, "Dream", 2007],
  ["Adelie", 185, 3000, "Dream", 2007],
  ["Adelie", 190, 4600, "Dream", 2007],
  ["Adelie", 182, 3425, "Dream", 2007],
  ["Adelie", 179, 2975, "Dream", 2007],
  ["Adelie", 190, 3450, "Dream", 2007],
  ["Adelie", 191, 4150, "Dream", 2007],
  ["Adelie", 186, 3500, "Biscoe", 2008],
  ["Adelie", 188, 4300, "Biscoe", 2008],
  ["Adelie", 190, 3450, "Biscoe", 2008],
  ["Adelie", 200, 4050, "Biscoe", 2008],
  ["Adelie", 187, 2900, "Biscoe", 2008],
  ["Adelie", 191, 3700, "Biscoe", 2008],
  ["Adelie", 186, 3550, "Biscoe", 2008],
  ["Adelie", 193, 3800, "Biscoe", 2008],
  ["Adelie", 181, 2850, "Biscoe", 2008],
  ["Adelie", 194, 3750, "Biscoe", 2008],
  ["Adelie", 185, 3150, "Biscoe", 2008],
  ["Adelie", 195, 4400, "Biscoe", 2008],
  ["Adelie", 185, 3600, "Biscoe", 2008],
  ["Adelie", 192, 4050, "Biscoe", 2008],
  ["Adelie", 184, 2850, "Biscoe", 2008],
  ["Adelie", 192, 3950, "Biscoe", 2008],
  ["Adelie", 195, 3350, "Biscoe", 2008],
  ["Adelie", 188, 4100, "Biscoe", 2008],
  ["Adelie", 190, 3050, "Torgersen", 2008],
  ["Adelie", 198, 4450, "Torgersen", 2008],
  ["Adelie", 190, 3600, "Torgersen", 2008],
  ["Adelie", 190, 3900, "Torgersen", 2008],
  ["Adelie", 196, 3550, "Torgersen", 2008],
  ["Adelie", 197, 4150, "Torgersen", 2008],
  ["Adelie", 190, 3700, "Torgersen", 2008],
  ["Adelie", 195, 4250, "Torgersen", 2008],
  ["Adelie", 191, 3700, "Torgersen", 2008],
  ["Adelie", 184, 3900, "Torgersen", 2008],
  ["Adelie", 187, 3550, "Torgersen", 2008],
  ["Adelie", 195, 4000, "Torgersen", 2008],
  ["Adelie", 189, 3200, "Torgersen", 2008],
  ["Adelie", 196, 4700, "Torgersen", 2008],
  ["Adelie", 187, 3800, "Torgersen", 2008],
  ["Adelie", 193, 4200, "Torgersen", 2008],
  ["Adelie", 191, 3350, "Dream", 2008],
  ["Adelie", 194, 3550, "Dream", 2008],
  ["Adelie", 190, 3800, "Dream", 2008],
  ["Adelie", 189, 3500, "Dream", 2008],
  ["Adelie", 189, 3950, "Dream", 2008],
  ["Adelie", 190, 3600, "Dream", 2008],
  ["Adelie", 202, 3550, "Dream", 2008],
  ["Adelie", 205, 4300, "Dream", 2008],
  ["Adelie", 185, 3400, "Dream", 2008],
  ["Adelie", 186, 4450, "Dream", 2008],
  ["Adelie", 187, 3300, "Dream", 2008],
  ["Adelie", 208, 4300, "Dream", 2008],
  ["Adelie", 190, 3700, "Dream", 2008],
  ["Adelie", 196, 4350, "Dream", 2008],
  ["Adelie", 178, 2900, "Dream", 2008],
  ["Adelie", 192, 4100, "Dream", 2008],
  ["Adelie", 192, 3725, "Biscoe", 2009],
  ["Adelie", 203, 4725, "Biscoe", 2009],
  ["Adelie", 183, 3075, "Biscoe", 2009],
  ["Adelie", 190, 4250, "Biscoe", 2009],
  ["Adelie", 193, 2925, "Biscoe", 2009],
  ["Adelie", 184, 3550, "Biscoe", 2009],
  ["Adelie", 199, 3750, "Biscoe", 2009],
  ["Adelie", 190, 3900, "Biscoe", 2009],
  ["Adelie", 181, 3175, "Biscoe", 2009],
  ["Adelie", 197, 4775, "Biscoe", 2009],
  ["Adelie", 198, 3825, "Biscoe", 2009],
  ["Adelie", 191, 4600, "Biscoe", 2009],
  ["Adelie", 193, 3200, "Biscoe", 2009],
  ["Adelie", 197, 4275, "Biscoe", 2009],
  ["Adelie", 191, 3900, "Biscoe", 2009],
  ["Adelie", 196, 4075, "Biscoe", 2009],
  ["Adelie", 188, 2900, "Torgersen", 2009],
  ["Adelie", 199, 3775, "Torgersen", 2009],
  ["Adelie", 189, 3350, "Torgersen", 2009],
  ["Adelie", 189, 3325, "Torgersen", 2009],
  ["Adelie", 187, 3150, "Torgersen", 2009],
  ["Adelie", 198, 3500, "Torgersen", 2009],
  ["Adelie", 176, 3450, "Torgersen", 2009],
  ["Adelie", 202, 3875, "Torgersen", 2009],
  ["Adelie", 186, 3050, "Torgersen", 2009],
  ["Adelie", 199, 4000, "Torgersen", 2009],
  ["Adelie", 191, 3275, "Torgersen", 2009],
  ["Adelie", 195, 4300, "Torgersen", 2009],
  ["Adelie", 191, 3050, "Torgersen", 2009],
  ["Adelie", 210, 4000, "Torgersen", 2009],
  ["Adelie", 190, 3325, "Torgersen", 2009],
  ["Adelie", 197, 3500, "Torgersen", 2009],
  ["Adelie", 193, 3500, "Dream", 2009],
  ["Adelie", 199, 4475, "Dream", 2009],
  ["Adelie", 187, 3425, "Dream", 2009],
  ["Adelie", 190, 3900, "Dream", 2009],
  ["Adelie", 191, 3175, "Dream", 2009],
  ["Adelie", 200, 3975, "Dream", 2009],
  ["Adelie", 185, 3400, "Dream", 2009],
  ["Adelie", 193, 4250, "Dream", 2009],
  ["Adelie", 193, 3400, "Dream", 2009],
  ["Adelie", 187, 3475, "Dream", 2009],
  ["Adelie", 188, 3050, "Dream", 2009],
  ["Adelie", 190, 3725, "Dream", 2009],
  ["Adelie", 192, 3000, "Dream", 2009],
  ["Adelie", 185, 3650, "Dream", 2009],
  ["Adelie", 190, 4250, "Dream", 2009],
  ["Adelie", 184, 3475, "Dream", 2009],
  ["Adelie", 195, 3450, "Dream", 2009],
  ["Adelie", 193, 3750, "Dream", 2009],
  ["Adelie", 187, 3700, "Dream", 2009],
  ["Adelie", 201, 4000, "Dream", 2009],
  ["Gentoo", 211, 4500, "Biscoe", 2007],
  ["Gentoo", 230, 5700, "Biscoe", 2007],
  ["Gentoo", 210, 4450, "Biscoe", 2007],
  ["Gentoo", 218, 5700, "Biscoe", 2007],
  ["Gentoo", 215, 5400, "Biscoe", 2007],
  ["Gentoo", 210, 4550, "Biscoe", 2007],
  ["Gentoo", 211, 4800, "Biscoe", 2007],
  ["Gentoo", 219, 5200, "Biscoe", 2007],
  ["Gentoo", 209, 4400, "Biscoe", 2007],
  ["Gentoo", 215, 5150, "Biscoe", 2007],
  ["Gentoo", 214, 4650, "Biscoe", 2007],
  ["Gentoo", 216, 5550, "Biscoe", 2007],
  ["Gentoo", 214, 4650, "Biscoe", 2007],
  ["Gentoo", 213, 5850, "Biscoe", 2007],
  ["Gentoo", 210, 4200, "Biscoe", 2007],
  ["Gentoo", 217, 5850, "Biscoe", 2007],
  ["Gentoo", 210, 4150, "Biscoe", 2007],
  ["Gentoo", 221, 6300, "Biscoe", 2007],
  ["Gentoo", 209, 4800, "Biscoe", 2007],
  ["Gentoo", 222, 5350, "Biscoe", 2007],
  ["Gentoo", 218, 5700, "Biscoe", 2007],
  ["Gentoo", 215, 5000, "Biscoe", 2007],
  ["Gentoo", 213, 4400, "Biscoe", 2007],
  ["Gentoo", 215, 5050, "Biscoe", 2007],
  ["Gentoo", 215, 5000, "Biscoe", 2007],
  ["Gentoo", 215, 5100, "Biscoe", 2007],
  ["Gentoo", 216, 4100, "Biscoe", 2007],
  ["Gentoo", 215, 5650, "Biscoe", 2007],
  ["Gentoo", 210, 4600, "Biscoe", 2007],
  ["Gentoo", 220, 5550, "Biscoe", 2007],
  ["Gentoo", 222, 5250, "Biscoe", 2007],
  ["Gentoo", 209, 4700, "Biscoe", 2007],
  ["Gentoo", 207, 5050, "Biscoe", 2007],
  ["Gentoo", 230, 6050, "Biscoe", 2007],
  ["Gentoo", 220, 5150, "Biscoe", 2008],
  ["Gentoo", 220, 5400, "Biscoe", 2008],
  ["Gentoo", 213, 4950, "Biscoe", 2008],
  ["Gentoo", 219, 5250, "Biscoe", 2008],
  ["Gentoo", 208, 4350, "Biscoe", 2008],
  ["Gentoo", 208, 5350, "Biscoe", 2008],
  ["Gentoo", 208, 3950, "Biscoe", 2008],
  ["Gentoo", 225, 5700, "Biscoe", 2008],
  ["Gentoo", 210, 4300, "Biscoe", 2008],
  ["Gentoo", 216, 4750, "Biscoe", 2008],
  ["Gentoo", 222, 5550, "Biscoe", 2008],
  ["Gentoo", 217, 4900, "Biscoe", 2008],
  ["Gentoo", 210, 4200, "Biscoe", 2008],
  ["Gentoo", 225, 5400, "Biscoe", 2008],
  ["Gentoo", 213, 5100, "Biscoe", 2008],
  ["Gentoo", 215, 5300, "Biscoe", 2008],
  ["Gentoo", 210, 4850, "Biscoe", 2008],
  ["Gentoo", 220, 5300, "Biscoe", 2008],
  ["Gentoo", 210, 4400, "Biscoe", 2008],
  ["Gentoo", 225, 5000, "Biscoe", 2008],
  ["Gentoo", 217, 4900, "Biscoe", 2008],
  ["Gentoo", 220, 5050, "Biscoe", 2008],
  ["Gentoo", 208, 4300, "Biscoe", 2008],
  ["Gentoo", 220, 5000, "Biscoe", 2008],
  ["Gentoo", 208, 4450, "Biscoe", 2008],
  ["Gentoo", 224, 5550, "Biscoe", 2008],
  ["Gentoo", 208, 4200, "Biscoe", 2008],
  ["Gentoo", 221, 5300, "Biscoe", 2008],
  ["Gentoo", 214, 4400, "Biscoe", 2008],
  ["Gentoo", 231, 5650, "Biscoe", 2008],
  ["Gentoo", 219, 4700, "Biscoe", 2008],
  ["Gentoo", 230, 5700, "Biscoe", 2008],
  ["Gentoo", 214, 4650, "Biscoe", 2008],
  ["Gentoo", 229, 5800, "Biscoe", 2008],
  ["Gentoo", 220, 4700, "Biscoe", 2008],
  ["Gentoo", 223, 5550, "Biscoe", 2008],
  ["Gentoo", 216, 4750, "Biscoe", 2008],
  ["Gentoo", 221, 5000, "Biscoe", 2008],
  ["Gentoo", 221, 5100, "Biscoe", 2008],
  ["Gentoo", 217, 5200, "Biscoe", 2008],
  ["Gentoo", 216, 4700, "Biscoe", 2008],
  ["Gentoo", 230, 5800, "Biscoe", 2008],
  ["Gentoo", 209, 4600, "Biscoe", 2008],
  ["Gentoo", 220, 6000, "Biscoe", 2008],
  ["Gentoo", 215, 4750, "Biscoe", 2008],
  ["Gentoo", 223, 5950, "Biscoe", 2008],
  ["Gentoo", 212, 4625, "Biscoe", 2009],
  ["Gentoo", 221, 5450, "Biscoe", 2009],
  ["Gentoo", 212, 4725, "Biscoe", 2009],
  ["Gentoo", 224, 5350, "Biscoe", 2009],
  ["Gentoo", 212, 4750, "Biscoe", 2009],
  ["Gentoo", 228, 5600, "Biscoe", 2009],
  ["Gentoo", 218, 4600, "Biscoe", 2009],
  ["Gentoo", 218, 5300, "Biscoe", 2009],
  ["Gentoo", 212, 4875, "Biscoe", 2009],
  ["Gentoo", 230, 5550, "Biscoe", 2009],
  ["Gentoo", 218, 4950, "Biscoe", 2009],
  ["Gentoo", 228, 5400, "Biscoe", 2009],
  ["Gentoo", 212, 4750, "Biscoe", 2009],
  ["Gentoo", 224, 5650, "Biscoe", 2009],
  ["Gentoo", 214, 4850, "Biscoe", 2009],
  ["Gentoo", 226, 5200, "Biscoe", 2009],
  ["Gentoo", 216, 4925, "Biscoe", 2009],
  ["Gentoo", 222, 4875, "Biscoe", 2009],
  ["Gentoo", 203, 4625, "Biscoe", 2009],
  ["Gentoo", 225, 5250, "Biscoe", 2009],
  ["Gentoo", 219, 4850, "Biscoe", 2009],
  ["Gentoo", 228, 5600, "Biscoe", 2009],
  ["Gentoo", 215, 4975, "Biscoe", 2009],
  ["Gentoo", 228, 5500, "Biscoe", 2009],
  ["Gentoo", 216, 4725, "Biscoe", 2009],
  ["Gentoo", 215, 5500, "Biscoe", 2009],
  ["Gentoo", 210, 4700, "Biscoe", 2009],
  ["Gentoo", 219, 5500, "Biscoe", 2009],
  ["Gentoo", 208, 4575, "Biscoe", 2009],
  ["Gentoo", 209, 5500, "Biscoe", 2009],
  ["Gentoo", 216, 5000, "Biscoe", 2009],
  ["Gentoo", 229, 5950, "Biscoe", 2009],
  ["Gentoo", 213, 4650, "Biscoe", 2009],
  ["Gentoo", 230, 5500, "Biscoe", 2009],
  ["Gentoo", 217, 4375, "Biscoe", 2009],
  ["Gentoo", 230, 5850, "Biscoe", 2009],
  ["Gentoo", 217, 4875, "Biscoe", 2009],
  ["Gentoo", 222, 6000, "Biscoe", 2009],
  ["Gentoo", 214, 4925, "Biscoe", 2009],
  ["Gentoo", null, null, "Biscoe", 2009],
  ["Gentoo", 215, 4850, "Biscoe", 2009],
  ["Gentoo", 222, 5750, "Biscoe", 2009],
  ["Gentoo", 212, 5200, "Biscoe", 2009],
  ["Gentoo", 213, 5400, "Biscoe", 2009],
  ["Chinstrap", 192, 3500, "Dream", 2007],
  ["Chinstrap", 196, 3900, "Dream", 2007],
  ["Chinstrap", 193, 3650, "Dream", 2007],
  ["Chinstrap", 188, 3525, "Dream", 2007],
  ["Chinstrap", 197, 3725, "Dream", 2007],
  ["Chinstrap", 198, 3950, "Dream", 2007],
  ["Chinstrap", 178, 3250, "Dream", 2007],
  ["Chinstrap", 197, 3750, "Dream", 2007],
  ["Chinstrap", 195, 4150, "Dream", 2007],
  ["Chinstrap", 198, 3700, "Dream", 2007],
  ["Chinstrap", 193, 3800, "Dream", 2007],
  ["Chinstrap", 194, 3775, "Dream", 2007],
  ["Chinstrap", 185, 3700, "Dream", 2007],
  ["Chinstrap", 201, 4050, "Dream", 2007],
  ["Chinstrap", 190, 3575, "Dream", 2007],
  ["Chinstrap", 201, 4050, "Dream", 2007],
  ["Chinstrap", 197, 3300, "Dream", 2007],
  ["Chinstrap", 181, 3700, "Dream", 2007],
  ["Chinstrap", 190, 3450, "Dream", 2007],
  ["Chinstrap", 195, 4400, "Dream", 2007],
  ["Chinstrap", 181, 3600, "Dream", 2007],
  ["Chinstrap", 191, 3400, "Dream", 2007],
  ["Chinstrap", 187, 2900, "Dream", 2007],
  ["Chinstrap", 193, 3800, "Dream", 2007],
  ["Chinstrap", 195, 3300, "Dream", 2007],
  ["Chinstrap", 197, 4150, "Dream", 2007],
  ["Chinstrap", 200, 3400, "Dream", 2008],
  ["Chinstrap", 200, 3800, "Dream", 2008],
  ["Chinstrap", 191, 3700, "Dream", 2008],
  ["Chinstrap", 205, 4550, "Dream", 2008],
  ["Chinstrap", 187, 3200, "Dream", 2008],
  ["Chinstrap", 201, 4300, "Dream", 2008],
  ["Chinstrap", 187, 3350, "Dream", 2008],
  ["Chinstrap", 203, 4100, "Dream", 2008],
  ["Chinstrap", 195, 3600, "Dream", 2008],
  ["Chinstrap", 199, 3900, "Dream", 2008],
  ["Chinstrap", 195, 3850, "Dream", 2008],
  ["Chinstrap", 210, 4800, "Dream", 2008],
  ["Chinstrap", 192, 2700, "Dream", 2008],
  ["Chinstrap", 205, 4500, "Dream", 2008],
  ["Chinstrap", 210, 3950, "Dream", 2008],
  ["Chinstrap", 187, 3650, "Dream", 2008],
  ["Chinstrap", 196, 3550, "Dream", 2008],
  ["Chinstrap", 196, 3500, "Dream", 2008],
  ["Chinstrap", 196, 3675, "Dream", 2009],
  ["Chinstrap", 201, 4450, "Dream", 2009],
  ["Chinstrap", 190, 3400, "Dream", 2009],
  ["Chinstrap", 212, 4300, "Dream", 2009],
  ["Chinstrap", 187, 3250, "Dream", 2009],
  ["Chinstrap", 198, 3675, "Dream", 2009],
  ["Chinstrap", 199, 3325, "Dream", 2009],
  ["Chinstrap", 201, 3950, "Dream", 2009],
  ["Chinstrap", 193, 3600, "Dream", 2009],
  ["Chinstrap", 203, 4050, "Dream", 2009],
  ["Chinstrap", 187, 3350, "Dream", 2009],
  ["Chinstrap", 197, 3450, "Dream", 2009],
  ["Chinstrap", 191, 3250, "Dream", 2009],
  ["Chinstrap", 203, 4050, "Dream", 2009],
  ["Chinstrap", 202, 3800, "Dream", 2009],
  ["Chinstrap", 194, 3525, "Dream", 2009],
  ["Chinstrap", 206, 3950, "Dream", 2009],
  ["Chinstrap", 189, 3650, "Dream", 2009],
  ["Chinstrap", 195, 3650, "Dream", 2009],
  ["Chinstrap", 207, 4000, "Dream", 2009],
  ["Chinstrap", 202, 3400, "Dream", 2009],
  ["Chinstrap", 193, 3775, "Dream", 2009],
  ["Chinstrap", 210, 4100, "Dream", 2009],
  ["Chinstrap", 198, 3775, "Dream", 2009],
];
const speciesColors: Readonly<Record<string, string>> = {
  Adelie: "#2878b5",
  Chinstrap: "#d47722",
  Gentoo: "#288777",
};
const seed: readonly Row[] = measurements.map(
  ([species, x, y, island, year], index) => ({
    id: `penguin-${String(index + 1).padStart(3, "0")}`,
    x,
    y,
    label: species,
    color: speciesColors[species],
    island,
    year,
  }),
);
const ink = "#182c42",
  muted = "#62758b";
type Controls = {
  rows: WritableSignal<readonly Row[]>;
  selected: WritableSignal<string>;
  clicks: WritableSignal<number>;
  fixture: Fixture;
};
function step(controls: Controls, delta: number) {
  const rows = controls.rows.get().filter((d) => d.x !== null && d.y !== null);
  if (!rows.length) return;
  const index = rows.findIndex((d) => d.id === controls.selected.get());
  controls.selected.set(rows[(index + delta + rows.length) % rows.length].id);
}
function Marker({ datum, controls }: { datum: Row; controls: Controls }) {
  const count = useSignal(0);
  const selected = controls.selected.get() === datum.id;
  controls.fixture.onMark?.(datum.id, count.get());
  return (
    <Group>
      <Rectangle
        style={{
          x: -4,
          y: -4,
          width: 8,
          height: 8,
          fill: selected ? datum.color : "#fff",
          stroke: datum.color,
          strokeWidth: 2,
          cursor: "pointer",
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "touch") controls.selected.set(datum.id);
        }}
        onPointerDown={() =>
          batch(() => {
            count.update((v) => v + 1);
            controls.clicks.update((v) => v + 1);
            controls.selected.set(datum.id);
          })
        }
      />
    </Group>
  );
}
function PointLabel({ datum }: { datum: Row }) {
  const xs = useScale("x").get(),
    ys = useScale("y").get();
  const anchorX = xs.map(datum.x!),
    anchorY = ys.map(datum.y!);
  const width = Math.min(176, xs.frame.width),
    height = 52;
  const left = Math.max(0, Math.min(anchorX + 14, xs.frame.width - width));
  const top = Math.max(
    0,
    Math.min(anchorY - height - 12, ys.frame.height - height),
  );
  return (
    <Group style={{ translateX: left - anchorX, translateY: top - anchorY }}>
      <Rectangle
        pointerEvents="none"
        style={{
          width,
          height,
          cornerRadius: 7,
          fill: "rgba(255,255,255,0.92)",
          stroke: "rgba(98,117,139,0.35)",
          strokeWidth: 1,
        }}
      />
      <Text
        pointerEvents="none"
        style={{ x: 10, y: 9, font: "bold 12px sans-serif", fill: ink }}
      >
        {datum.label}
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 10, y: 29, font: "12px sans-serif", fill: ink }}
      >{`${datum.x} mm · ${datum.y} g`}</Text>
    </Group>
  );
}
function Plot({
  controls,
  index,
  origin,
}: {
  controls: Controls;
  index: number;
  origin: { x: number; y: number };
}) {
  const xs = useScale("x").get(),
    ys = useScale("y").get();
  const data = controls.rows.get();
  const selected = controls.selected.get();
  const anchors = data
    .filter((d) => d.x !== null && d.y !== null)
    .map((d) => ({
      id: d.id,
      x: origin.x + xs.map(d.x!),
      y: origin.y + ys.map(d.y!),
    }));
  controls.fixture.onPanel?.(index, {
    width: xs.frame.width,
    height: ys.frame.height,
    anchors,
  });
  const inspect = (x: number, y: number) => {
    const found = nearestPoint(
      data,
      { x: x - origin.x, y: y - origin.y },
      { x: "x", y: "y", xScale: xs, yScale: ys, maxDistance: 40 },
    );
    if (found) controls.selected.set(found.datum.id);
  };
  return (
    <Group>
      <Rectangle
        style={{
          width: xs.frame.width,
          height: ys.frame.height,
          fill: "#fff",
          cursor: "crosshair",
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch") inspect(e.x, e.y);
        }}
        onPointerDown={(e) => inspect(e.x, e.y)}
      />
      {[1, 2, 3, 4].map((step) => {
        const domain = controls.fixture.yDomain ?? [2500, 6500];
        const value = domain[0] + ((domain[1] - domain[0]) * step) / 5;
        return (
          <Line
            key={value}
            pointerEvents="none"
            style={{
              coords: [
                [0, ys.map(value)],
                [xs.frame.width, ys.map(value)],
              ],
              stroke: "#e9eef4",
              strokeWidth: 1,
            }}
          />
        );
      })}
      <Axis
        scale="x"
        position="bottom"
        tickCount={6}
        style={{ stroke: "#b8c6d4", fill: muted, font: "10px sans-serif" }}
      />
      <Axis
        scale="y"
        position="left"
        tickCount={6}
        style={{ stroke: "#b8c6d4", fill: muted, font: "10px sans-serif" }}
      />
      {index === 0 && (
        <PointSeries
          data={data}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          pointerEvents="none"
          style={(d) => ({
            radius: d.id === selected ? 6 : 3.5,
            fill: d.color,
            opacity: 0.6,
          })}
        />
      )}
      <Text
        pointerEvents="none"
        style={{
          x: xs.frame.width / 2,
          y: ys.frame.height + 23,
          textAlign: "center",
          font: "10px sans-serif",
          fill: muted,
        }}
      >
        Flipper length (mm)
      </Text>
      {index === 1 && (
        <PlotSeries
          data={data}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          keyBy="id"
          render={(d) => <Marker datum={d} controls={controls} />}
        />
      )}
      {/* Paint the inspection overlay after every mark in either plot. */}
      <PlotSeries
        data={data.filter((d) => d.id === selected)}
        x="x"
        y="y"
        xScale="x"
        yScale="y"
        keyBy="id"
        render={(d) => (
          <Group>
            <Circle
              pointerEvents="none"
              style={{ radius: 9, stroke: d.color, strokeWidth: 2 }}
            />
            <PointLabel datum={d} />
          </Group>
        )}
      />
    </Group>
  );
}
function Panel({
  controls,
  index,
  origin,
}: {
  controls: Controls;
  index: number;
  origin: { x: number; y: number };
  style?: BoxStyle & LayoutItemStyle;
}) {
  const box = useLayoutBox();
  const width = Math.max(1, box.width - 66),
    height = Math.max(1, box.height - 100);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{
          width: box.width,
          height: box.height,
          fill: "#fff",
          stroke: "#dbe3ec",
          strokeWidth: 1,
        }}
      />
      <Text style={{ x: 20, y: 18, fill: ink, font: "bold 16px sans-serif" }}>
        {index === 0 ? "01   Batched dots" : "02   Your own elements"}
      </Text>
      <Text style={{ x: 20, y: 42, fill: muted, font: "11px sans-serif" }}>
        Body mass (g)
      </Text>
      <Absolute>
        <Scale
          id="x"
          type="linear"
          domain={controls.fixture.xDomain ?? [170, 240]}
          range="width"
          style={{ left: 44, top: 64, width, height }}
        >
          <Scale
            id="y"
            type="linear"
            domain={controls.fixture.yDomain ?? [2500, 6500]}
            range="height"
            reverse
          >
            <Plot
              controls={controls}
              index={index}
              origin={{ x: origin.x + 44, y: origin.y + 64 }}
            />
          </Scale>
        </Scale>
      </Absolute>
    </Group>
  );
}
function Button({
  text,
  action,
  left,
  top,
  width = 102,
}: {
  text: string;
  action: () => void;
  left: number;
  top: number;
  width?: number;
}) {
  return (
    <Group style={{ translateX: left, translateY: top }}>
      <Rectangle
        style={{ width, height: 38, fill: "#e6edf5", cursor: "pointer" }}
        onClick={action}
      />
      <Text
        pointerEvents="none"
        style={{
          x: width / 2,
          y: 19,
          textAlign: "center",
          textBaseline: "middle",
          font: "12px sans-serif",
          fill: ink,
        }}
      >
        {text}
      </Text>
    </Group>
  );
}
function Scene({ fixture }: { fixture: Fixture }) {
  const box = useLayoutBox();
  const ownRows = useSignal(seed),
    ownSelected = useSignal("penguin-001"),
    ownClicks = useSignal(0);
  const controls: Controls = {
    rows: fixture.rows ?? ownRows,
    selected: fixture.selected ?? ownSelected,
    clicks: fixture.clicks ?? ownClicks,
    fixture,
  };
  const current = controls.rows
    .get()
    .find((d) => d.id === controls.selected.get());
  fixture.onReading?.(controls.selected.get(), controls.clicks.get());
  const narrow = box.width < 740;
  const content = Math.max(280, box.width - 48);
  const gap = 18;
  const leftWidth = narrow ? content : (content - gap) * 0.56;
  const rightWidth = narrow ? content : content - gap - leftWidth;
  const columns = Math.max(1, Math.min(5, Math.floor((content + 8) / 110)));
  const buttonPosition = (i: number) => ({
    left: 24 + (i % columns) * 110,
    top: 86 + Math.floor(i / columns) * 46,
  });
  const top = 170 + (Math.ceil(5 / columns) - 1) * 46;
  const height = narrow
    ? Math.max(160, (box.height - top - 44 - gap) / 2)
    : Math.max(240, box.height - top - 60);
  const rightX = narrow ? 24 : 24 + leftWidth + gap;
  const rightY = narrow ? top + height + gap : top;
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#f4f7fb" }}
      />
      <Text style={{ x: 24, y: 20, font: "bold 25px sans-serif", fill: ink }}>
        Palmer penguins
      </Text>
      <Text style={{ x: 24, y: 52, font: "11px sans-serif", fill: muted }}>
        {box.width < 600
          ? "2007–2009 · 342 measured / 344 penguins"
          : "344 penguins across three Antarctic islands · 2007–2009 · Two missing measurements omitted"}
      </Text>
      {["Adelie", "Chinstrap", "Gentoo"].map((species, index) => (
        <Group
          key={species}
          style={{ translateX: 28 + index * 96, translateY: 75 }}
        >
          <Circle
            pointerEvents="none"
            style={{ radius: 3, fill: speciesColors[species] }}
          />
          <Text
            pointerEvents="none"
            style={{ x: 9, y: -6, font: "11px sans-serif", fill: ink }}
          >
            {species}
          </Text>
        </Group>
      ))}
      <Button
        text="← Previous"
        left={buttonPosition(0).left}
        top={buttonPosition(0).top}
        action={() => step(controls, -1)}
      />
      <Button
        text="Next →"
        left={buttonPosition(1).left}
        top={buttonPosition(1).top}
        action={() => step(controls, 1)}
      />
      <Button
        text="Reorder"
        left={buttonPosition(2).left}
        top={buttonPosition(2).top}
        action={() => controls.rows.update((rows) => [...rows].reverse())}
      />
      <Button
        text="Remove"
        left={buttonPosition(3).left}
        top={buttonPosition(3).top}
        action={() =>
          controls.rows.update((rows) =>
            rows.filter((d) => d.id !== controls.selected.get()),
          )
        }
      />
      <Button
        text="Reset"
        left={buttonPosition(4).left}
        top={buttonPosition(4).top}
        action={() =>
          batch(() => {
            controls.rows.set(seed);
            controls.selected.set("penguin-001");
            controls.clicks.set(0);
          })
        }
      />
      <Text style={{ x: 24, y: top - 30, font: "12px monospace", fill: ink }}>
        {current
          ? box.width < 600
            ? `${current.label} · ${current.x} mm · ${current.y} g`
            : `${current.label} · ${current.x} mm · ${current.y} g · ${current.island ?? ""} ${current.year ?? ""} · custom clicks ${controls.clicks.get()}`
          : "Select a point"}
      </Text>
      <Absolute>
        <Panel
          key="scatter"
          controls={controls}
          index={0}
          origin={{ x: 24, y: top }}
          style={{ left: 24, top, width: leftWidth, height }}
        />
        <Panel
          key="custom"
          controls={controls}
          index={1}
          origin={{ x: rightX, y: rightY }}
          style={{ left: rightX, top: rightY, width: rightWidth, height }}
        />
      </Absolute>
      <Text
        style={{
          x: 24,
          y: rightY + height + 18,
          font: "11px sans-serif",
          fill: muted,
        }}
      >
        {box.width < 600
          ? "Tap to inspect · Squares keep click counts"
          : "Hover or tap to inspect · Click custom squares · Reorder preserves each penguin’s click count"}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 24,
          y: rightY + height + 33,
          font: "10px sans-serif",
          fill: muted,
        }}
      >
        Data: Gorman / Palmer LTER · palmerpenguins · CC0
      </Text>
    </Group>
  );
}
// VIZ_POINTS_SOURCE_ID = 'viz-points-example'
export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): CRCController {
  const previousMinHeight = canvas.style.minHeight;
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.minHeight = "720px";
  canvas.style.touchAction = "pan-y";
  // The Studio iframe is shorter than stacked plots on a phone. Scroll its
  // existing document; this is host presentation, not Canvas scrolling.
  const host = canvas.parentElement;
  const previousOverflow = host?.style.overflow;
  if (host) host.style.overflow = "auto";
  try {
    const controller = crc(canvas, <Scene fixture={fixture} />, {
      viewport: "responsive",
    });
    return {
      dispose() {
        controller.dispose();
        canvas.style.minHeight = previousMinHeight;
        canvas.style.touchAction = previousTouchAction;
        if (host) host.style.overflow = previousOverflow ?? "";
      },
    };
  } catch (error) {
    canvas.style.minHeight = previousMinHeight;
    canvas.style.touchAction = previousTouchAction;
    if (host) host.style.overflow = previousOverflow ?? "";
    throw error;
  }
}
