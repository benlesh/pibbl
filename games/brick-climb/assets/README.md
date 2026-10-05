# Brick Climb artwork

Generated with the built-in image generation tool on 2026-10-05. The original
PNG outputs are preserved; JSON describes measured rectangles and logical
alignment. No image was programmatically repainted or resampled.

- `sprites.png`: initial mixed atlas; retained for bricks and fragment art.
- `character-v2.png`: replacement character, six run poses, rise/fall, two idle
  poses, and two skid poses.
- `coins-v3.png`: replacement eight-frame half-turn (identical front/back),
  including intermediate angles. The discarded second coin attempt repeated
  four silhouettes and was not selected.

The first prompt requested a 1024×1024, 4×4 atlas with the same original
brown-haired adventurer in teal overalls and an orange scarf, four movement
frames, jump/fall/crouch/celebrate, four coin views, and brick/fragment/stone
art. The actual output was 1254×1254. Metadata is measured, not inferred from
that requested size.

## Selected character prompt

Create a NEW transparent character-only production sprite sheet matching the
original brown-haired teal-overalls orange-scarf adventurer in the reference.
Exactly 4 columns x 3 rows = 12 poses, evenly spaced cells, generous transparent
gutters. No coin or brick. All face RIGHT, same body proportions, same camera
and pixel-art style. Read row-major: frames 0 through 5 are SIX DIFFERENT
consecutive phases of a full run cycle: 0 right foot forward contact left foot
back; 1 right leg supporting with left knee swinging under; 2 left knee high
passing right leg trailing; 3 left foot forward contact right foot back; 4 left
leg supporting right knee swinging under; 5 right knee high passing left leg
trailing. They must form a coherent alternating-leg cycle, not six
near-identical lunges. Frame 6 airborne rising with tucked legs; frame 7 airborne
falling legs extending to land; frames 8 and 9 standing idle subtle breathing;
frames 10 and 11 braking skid progression facing right with torso leaning back.
Exact same character scale, centered pelvis x in every cell, common standing
ground baseline near bottom of cell. Hard pixel edges, sparse readable detail.
Absolutely no text, labels, border, checkerboard or shadows on background. True
alpha transparency.

## Selected coin prompt

Create production golden pixel art coin animation atlas ONLY. Exactly 8 cells
in 4 columns x 2 rows on genuine transparent background. Fix prior problem of
repeating four silhouettes. The coin has identical front and back; animate ONE
HALF TURN in EIGHT DISTINCT ANGULAR STEPS at 0,22.5,45,67.5,90,112.5,135,157.5
degrees. This half-turn repeats seamlessly due to identical faces. Widths per
cell as fraction of diameter must be approximately
1.0,0.93,0.72,0.40,0.12,0.40,0.72,0.93. Thus row1 widths get progressively
narrower; row2 begins thin edge then grows progressively wider. All 8 coins have
EXACT SAME HEIGHT AND CENTER in their cells. Match reference coin yellow orange
pixel art with four-point diamond emblem, constant lighting upper left. No
additional images, grid, text, particles, background, shadow or checkerboard.
Large transparent gutters. Pixel crisp.

## Review notes

The character run bounds range from 276–285 pixels high before normalization.
The six poses are distinct, but foot progression still requires animated human
review. Coin heights vary from 257–261 pixels; metadata centers their original
pixels within a shared 280×280 logical frame. Measured widths are 256, 246,
187, 154, 93, 159, 208, 251. The edge is thicker than requested; review the
actual loop before approving the art. Cropping uses an alpha threshold of 20
for meaningful bounds, so faint generated fringe pixels outside those bounds
are excluded from drawing without altering the original PNG.
