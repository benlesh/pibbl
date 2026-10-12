// Fixed-return query and animation contracts must survive both package resolvers.
import * as namedQueries from '@pibbl/core/physics/2d';
import * as namedCore from '@pibbl/core';
export function standaloneApiContracts(
  world: namedQueries.PibblPhysicsWorldHandle2D,
  shape: namedQueries.PibblPhysicsShape2D,
  ray: namedQueries.PibblPhysicsRay2D,
  pose: namedQueries.PibblPhysicsPose2D,
  bounds: namedQueries.PibblPhysicsAabb2D,
  point: namedQueries.PibblPhysicsVector2,
) {
  const raycastAny2D: boolean = namedQueries.raycastAny2D(world, ray);
  void raycastAny2D;
  const raycastClosest2D: namedQueries.PibblPhysicsQueryHit2D | null = namedQueries.raycastClosest2D(world, ray);
  void raycastClosest2D;
  const raycastAll2D: readonly namedQueries.PibblPhysicsQueryHit2D[] = namedQueries.raycastAll2D(world, ray);
  void raycastAll2D;
  const shapeCastAny2D: boolean = namedQueries.shapeCastAny2D(world, shape, pose, point);
  void shapeCastAny2D;
  const shapeCastClosest2D: namedQueries.PibblPhysicsQueryHit2D | null = namedQueries.shapeCastClosest2D(world, shape, pose, point);
  void shapeCastClosest2D;
  const shapeCastAll2D: readonly namedQueries.PibblPhysicsQueryHit2D[] = namedQueries.shapeCastAll2D(world, shape, pose, point);
  void shapeCastAll2D;
  const hasShapeOverlap2D: boolean = namedQueries.hasShapeOverlap2D(world, shape, pose);
  void hasShapeOverlap2D;
  const findShapeOverlap2D: namedQueries.PibblPhysicsQueryMatch2D | null = namedQueries.findShapeOverlap2D(world, shape, pose);
  void findShapeOverlap2D;
  const findAllShapeOverlaps2D: readonly namedQueries.PibblPhysicsQueryMatch2D[] = namedQueries.findAllShapeOverlaps2D(world, shape, pose);
  void findAllShapeOverlaps2D;
  const hasAabbMatch2D: boolean = namedQueries.hasAabbMatch2D(world, bounds);
  void hasAabbMatch2D;
  const findAabbMatch2D: namedQueries.PibblPhysicsQueryMatch2D | null = namedQueries.findAabbMatch2D(world, bounds);
  void findAabbMatch2D;
  const findAllAabbMatches2D: readonly namedQueries.PibblPhysicsQueryMatch2D[] = namedQueries.findAllAabbMatches2D(world, bounds);
  void findAllAabbMatches2D;
  const hasPointMatch2D: boolean = namedQueries.hasPointMatch2D(world, point);
  void hasPointMatch2D;
  const findPointMatch2D: namedQueries.PibblPhysicsQueryMatch2D | null = namedQueries.findPointMatch2D(world, point);
  void findPointMatch2D;
  const findAllPointMatches2D: readonly namedQueries.PibblPhysicsQueryMatch2D[] = namedQueries.findAllPointMatches2D(world, point);
  void findAllPointMatches2D;
  const target = namedCore.signal(10);
  const springOptions = namedCore.signal({ animation: namedCore.spring({ stiffness: namedCore.signal(100).get() }) });
  const tweenOptions = namedCore.signal({ animation: namedCore.tween({ duration: namedCore.signal(100).get() }) });
  const sprung: namedCore.Signal<number> = namedCore.useAnimatedValue(target, springOptions);
  const tweened: namedCore.Signal<number> = namedCore.useAnimatedValue(target, tweenOptions);
  void [sprung, tweened];
  // @ts-expect-error mode is no longer public query configuration.
  namedQueries.raycastAny2D(world, ray, { mode: 'all' });
  // @ts-expect-error spring inputs are numeric.
  namedCore.useAnimatedValue('ten', { animation: namedCore.spring() });
  // @ts-expect-error named hooks do not accept a type selector.
  namedCore.useAnimatedValue(10, { animation: namedCore.tween({ duration: 100 }), type: 'tween' });
  // @ts-expect-error named hooks do not accept a type selector.
  namedCore.useAnimatedValue(10, { animation: namedCore.spring({  }), type: 'spring' });
  // @ts-expect-error the temporary split hook was removed.
  namedCore.useSpringValue;
  // @ts-expect-error the temporary split hook was removed.
  namedCore.useTweenValue;
  // @ts-expect-error the former selector-driven query was removed.
  namedQueries.raycast2D;
  // @ts-expect-error public filter options have no generic result-mode parameter.
  const options: namedQueries.PibblPhysicsQueryOptions2D<'all'> = {};
  void options;
}
