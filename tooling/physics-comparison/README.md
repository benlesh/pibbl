# Physics engine comparison

These private experiments compare the Pibbl kernel against pinned Planck 1.5.0
(MIT) and Rapier 2D compat 0.21.0 (Apache-2.0). The selected Rapier engine now powers public worlds. Install the candidates in an external scratch directory:

```sh
npm install --prefix /tmp/pibbl-physics-comparison --ignore-scripts --no-audit --no-fund planck@1.5.0 @dimforge/rapier2d-compat@0.21.0
node --import tsx tooling/physics-comparison/benchmark.mjs /tmp/pibbl-physics-comparison
node tooling/physics-comparison/rapier-contract.mjs /tmp/pibbl-physics-comparison
```

The benchmark uses equal box geometry, mass, friction, gravity, and accepted
1/60-second steps. Pibbl distances are 100 logical units per comparison unit.
The result includes machine metadata, median/p95 step cost, escaped body count,
and natural sleeping count. Sleep is enabled, so timings include the benefit
of successful settling. The `pibbl-rapier` rows include Pibbl integration and transactional checkpoints;
`planck` and `rapier` rows are bare engines. None include Canvas rendering or
public signal publication. These are not universal CI thresholds. A second
workload keeps 100 bodies awake alongside 1,001 static colliders.

The contract probe checks logical-unit scaling, natural sleep, stable body
handles across snapshot restore, exact replay following restore, and explicit
WASM world disposal. It is feasibility evidence, not a completed Pibbl adapter.

Authoritative references:

- [Rapier rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)
- [Rapier serialization](https://rapier.rs/docs/user_guides/javascript/serialization/)
- [Box2D simulation](https://box2d.org/documentation/md_simulation.html)
- [Planck documentation](https://piqnt.com/planck.js/docs/)
