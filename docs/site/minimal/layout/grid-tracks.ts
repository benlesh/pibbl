import {
  autoFillTracks,
  autoFitTracks,
  minmax,
  repeatTracks,
  type GridMinMaxTrack,
  type GridRepeatTrack,
  type GridTrack,
  type GridTrackBreadth,
} from "@pibbl/core";

const breadth: GridTrackBreadth = "1fr";
const bounded: GridMinMaxTrack = minmax({ min: 72, max: breadth });
const repeated: GridRepeatTrack = repeatTracks([bounded], { count: 2 });
const fill: GridRepeatTrack = autoFillTracks(96);
const fit: GridRepeatTrack = autoFitTracks(96);
const tracks: readonly GridTrack[] = [repeated, fill, fit];

const output = document.createElement("pre");
output.textContent = JSON.stringify(tracks, null, 2);
document.body.append(output);
