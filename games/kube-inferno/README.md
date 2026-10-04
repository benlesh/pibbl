# Kube Inferno

A standalone CRC Canvas 2D game. No Studio shell, sidebar, learning catalog, or
other navigation is loaded. Native HTML controls surround the CRC-rendered map.

From the repository root:

```sh
corepack pnpm@11.21.0 kube-inferno
```

Open **http://127.0.0.1:5190/**. The dedicated Vite entry builds independently:

```sh
corepack pnpm@11.21.0 kube-inferno:build
corepack pnpm@11.21.0 kube-inferno:check
node games/kube-inferno/browser.verify.mjs
```

The last command requires the local server running and installed Playwright
Chromium. It drives this exact page, checks semantic simulation state through a
read-only development observer, and saves screenshots under `/tmp`.

## First playable slice

A three-tip, nonmodal first-run guide explains fire, offline machines, and
construction/routing. Skip or complete it once to hide it on later visits;
How to play → Replay quick tips brings it back.

Watch the two apps overheat. Drag in a large server (or click its card, then an
empty map position). Connect load balancer → server → database using the circular
ports or the inspector selectors. Construction takes 20 simulation seconds.
Traffic redistributes when the server is ready, and pressure falls.

The inspector's Add replica button is a quick path that buys a small server with
both routes already connected. Investigate spends $250 and takes 25 seconds to
remove redundant queries, improving app efficiency. Retire removes a selected
component and its routes immediately. The entry gateway and primary database
cannot be retired. Pause, 1×/2× speed, pan, zoom, reduced effects, local records,
and New run are implemented. Every 60 simulation seconds the scenario progresses
through a demand surge, downturn, and attack; the attack phase also causes a
server failure. A shield needs gateway → shield → app routing with the direct
bypass removed to protect the app.

## Explicit limits

This is a feedback slice, not the full plan or a Kubernetes emulator. Machines
currently bundle compute and workload capacity. The request model uses aggregate
capacity rather than individual transactions. Events follow a repeatable scripted
sequence, not the complete seeded incident system. Read replicas add aggregate
read capacity; write mixes, cache warmup, reputation, manifest import, node/pod
separation, graceful drains, construction cancellation, and security breaches
remain future work. Prices and business constants need playtesting.

`Sprite` is an application-local prototype built through the public CRC
`definePrimitive` API. Its frame records support arbitrary rectangles and trim
placement, but the production sheet currently contains six machine appearances,
not authored animation clips. Lights, fire, smoke, sparks, and request motion are
animated by CRC's shared playback scheduler. Public `@crc/core` Sprite exports,
named frame animation, atlas adapters, and GIF decoding have not shipped.

## Assets and ownership

`assets/machines.png` is original generated artwork created for this game on
2026-10-03 from the approved concept. Six transparent atlas cells share an
isometric viewpoint. The atlas loads once per page and Sprite instances borrow it.
No image readback or image-processing dependency is included in the game.
Space Grotesk uses the repository's existing font dependency and bundled license.
The game mounts one CRC root, uses its playback scheduler, and disposes the root
and document listeners on teardown. Personal-best storage is optional and local.

See [Plan 006](../../docs/project-plans/006-kube-inferno.md).
