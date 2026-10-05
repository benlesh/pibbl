import {
  Absolute,
  batch,
  Clip,
  computed,
  createElement,
  pibbl,
  useCanvasContext,
  useComputed,
  useConst,
  useCursor,
  useEventListener,
  useEventTarget,
  useLayoutBox,
  useLinePath,
  usePlayback,
  useRectPath,
  useReaction,
  useRef,
  useSignal,
  useSvgPath,
  useAnimatedValue,
  definePrimitive,
  defineAnimation,
  easing,
  Flex,
  Flow,
  FocusManagement,
  Fragment,
  Grid,
  Group,
  HorizontalLine,
  Image,
  isSignal,
  keyframes,
  KeyboardNavigation,
  Layer,
  Line,
  measureElement,
  Overlay,
  parallel,
  Path,
  Rectangle,
  resolveSignalValue,
  repeat,
  sequence,
  signal,
  spring,
  stepper,
  SvgPath,
  Star,
  Text,
  drive,
  tween,
  untracked,
  VerticalLine,
  wait,
  marker,
  type PibblAnimationDefinition,
  type PibblAnimationOptions,
  type PibblAnimationProgram,
  type PibblAnimationRepeatDirection,
  type PibblAnimationRepeatOptions,
  type PibblAnimationSampleInput,
  type PibblComponent,
  type PibblController,
  type PibblEventHandler,
  type PibblElement,
  type PibblEasing,
  type PibblInterpolator,
  type PibblKeyframesOptions,
  type PibblNode,
  type PibblNodeInput,
  type PibblPlayback,
  type PibblPlaybackEvent,
  type PibblPlaybackOptions,
  type PibblPlaybackStatus,
  type PibblReactionOptions,
  type RectStyle,
  type PibblSpringOptions,
  type PibblSpringAnimatedValueOptions,
  type PibblStepperOptions,
  type PibblTweenOptions,
  type PibblTweenAnimatedValueOptions,
  type Signal,
  type SignalEquals,
  type SignalOptions,
  type SignalValue,
  type PibblTextInput,
  type WritableSignal,
} from '@pibbl/core';

// Removed hooks have no compatibility export from the package root.
// @ts-expect-error useState was replaced by useSignal
import { useState as removedUseState } from '@pibbl/core';
// @ts-expect-error StateUpdater was removed with useState
import type { StateUpdater as RemovedStateUpdater } from '@pibbl/core';
// @ts-expect-error useMemo was replaced by useConst and useComputed
import { useMemo as removedUseMemo } from '@pibbl/core';
// @ts-expect-error useWhenChanged was replaced by useReaction
import { useWhenChanged as removedUseWhenChanged } from '@pibbl/core';

const importedFinalVocabulary = {
  Absolute,
  batch,
  Clip,
  computed,
  createElement,
  pibbl,
  useCanvasContext,
  useComputed,
  useConst,
  useCursor,
  useEventListener,
  useEventTarget,
  useLayoutBox,
  useLinePath,
  usePlayback,
  useRectPath,
  useReaction,
  useRef,
  useSignal,
  useSvgPath,
  useAnimatedValue,
  definePrimitive,
  defineAnimation,
  easing,
  Flex,
  Flow,
  FocusManagement,
  Fragment,
  Grid,
  Group,
  HorizontalLine,
  Image,
  isSignal,
  keyframes,
  KeyboardNavigation,
  Layer,
  Line,
  measureElement,
  Overlay,
  parallel,
  Path,
  Rectangle,
  repeat,
  sequence,
  signal,
  spring,
  stepper,
  SvgPath,
  Star,
  Text,
  drive,
  tween,
  untracked,
  VerticalLine,
  wait,
  marker,
};

type RemovedHookVocabulary = [
  typeof removedUseState,
  RemovedStateUpdater<number>,
  typeof removedUseMemo,
  typeof removedUseWhenChanged,
];

function FinalVocabularyScene(): PibblNode {
  return (
    <FocusManagement>
      <KeyboardNavigation mode="directional">
        <Group>
          <Absolute style={{ width: 10, height: 10 }}>
            <Overlay style={{ width: 10, height: 10 }}>
              <Flow style={{ width: 10, height: 10 }}>
                <Flex style={{ width: 10, height: 10 }}>
                  <Grid
                    style={{
                      width: 10,
                      height: 10,
                      gridTemplateColumns: [10],
                      gridTemplateRows: [10],
                    }}
                  >
                    <Rectangle
                      style={{
                        width: 10,
                        height: 10,
                        gridColumnStart: 1,
                        gridRowStart: 1,
                      }}
                    />
                  </Grid>
                </Flex>
              </Flow>
            </Overlay>
          </Absolute>
        </Group>
      </KeyboardNavigation>
    </FocusManagement>
  );
}

const component: PibblComponent<Record<string, never>> = FinalVocabularyScene;
const element: PibblElement<any> = createElement(Rectangle, {
  style: { width: 1, height: 1 },
});
const pointerEventsVocabulary = (
  <>
    <Rectangle pointerEvents="none" style={{ width: 1, height: 1 }} />
    <Text pointerEvents="none">text</Text>
    <Image pointerEvents="none" style={{ src: 'image.png' }} />
    <HorizontalLine pointerEvents="none" style={{ y: 0, x2: 1 }} />
    <Star
      pointerEvents="none"
      style={{ points: 5, outerRadius: 1, innerRadius: 0.5 }}
    />
    {/* @ts-expect-error pointerEvents only supports auto and none */}
    <Rectangle pointerEvents="painted" style={{ width: 1, height: 1 }} />
    {/* @ts-expect-error pointerEvents must be a string policy */}
    <Rectangle pointerEvents={1} style={{ width: 1, height: 1 }} />
  </>
);
const controller = null as PibblController | null;
const signalEquals: SignalEquals<number> = (previous, next) => previous === next;
const signalOptions: SignalOptions<number> = {
  debugName: 'final vocabulary count',
  equals: signalEquals,
};
const inferredWritable = signal(1, signalOptions);
const writableCount: WritableSignal<number> = inferredWritable;
const readonlyCount: Signal<number> = writableCount.asReadonly();
const doubledCount: Signal<number> = computed(() => readonlyCount.get() * 2);
const untrackedCount: number = untracked(() => doubledCount.get());
const callbackSignal = signal<() => string>(() => 'ready');
const callbackValue: () => string = callbackSignal.get();
callbackSignal.set(() => 'updated');

const reactiveX = signal(10);
const reactiveFill = signal('red');
const reactiveHandler = signal<PibblEventHandler<'click'>>(() => {});
const reactiveStyle = signal<RectStyle>({
  left: 10,
  fill: 'red',
  width: 20,
  height: 20,
});
const signalValuedPrimitiveInputs = (
  <>
    <Rectangle
      style={{
        left: reactiveX,
        fill: reactiveFill,
        width: 20,
        height: 20,
      }}
      onClick={reactiveHandler}
    />
    <Rectangle style={reactiveStyle} />
  </>
);

function Gauge(props: { value: SignalValue<number> }) {
  return <Text>{resolveSignalValue(props.value)}</Text>;
}

const gauge = <Gauge value={reactiveX} />;
const ExactSignal = definePrimitive<{ valueSignal: Signal<number> }>(
  function renderExactSignal() {},
  { preserveSignalProps: ['valueSignal'] },
);
// @ts-expect-error exact signal-object props require preservation metadata
definePrimitive<{ valueSignal: Signal<number> }>(
  function renderUnpreservedExactSignal() {},
);
definePrimitive<{ value: number }>(
  function renderInvalidPreservedValue() {},
  {
    // @ts-expect-error only exact signal-object props may be preserved
    preserveSignalProps: ['value'],
  },
);
const exactSignal = <ExactSignal valueSignal={reactiveX} />;
// @ts-expect-error exact signal-object positions do not unwrap outer signals
const nestedExactSignal = <ExactSignal valueSignal={signal(reactiveX)} />;
const OptionalExactSignal = definePrimitive<{
  valueSignal?: Signal<number>;
  writableSignal?: WritableSignal<number>;
}>(
  function renderOptionalExactSignal() {},
  { preserveSignalProps: ['valueSignal', 'writableSignal'] },
);
// @ts-expect-error optional exact signal-object props require preservation metadata
definePrimitive<{ valueSignal?: Signal<number> }>(
  function renderUnpreservedOptionalExactSignal() {},
);
const optionalExactSignal = (
  <OptionalExactSignal
    valueSignal={readonlyCount}
    writableSignal={writableCount}
  />
);
const nestedOptionalExactSignal = (
  <OptionalExactSignal
    // @ts-expect-error optional exact signal-object positions do not unwrap outer signals
    valueSignal={signal(readonlyCount)}
  />
);
const nestedPaddingSignal = (
  <Rectangle
    style={{
      width: 20,
      height: 20,
      // @ts-expect-error nested descriptor fields are not recursively signal-valued
      padding: { left: reactiveX },
    }}
  />
);
const reactiveLabel = signal('Current');
const reactiveNode = signal<PibblNode>(
  <Rectangle style={{ width: 10, height: 10 }} />,
);
const publicNodeInput: PibblNodeInput = reactiveNode;
const publicTextInput: PibblTextInput = ['Value: ', reactiveLabel];
const signalValuedChildren = (
  <Group>
    {reactiveNode}
    <Text>{publicTextInput}</Text>
  </Group>
);
const nestedTextSignal = signal(reactiveLabel);
const invalidNestedTextSignal = (
  <Text>
    {/* @ts-expect-error a signal result must be a resolved signal-free text structure */}
    {nestedTextSignal}
  </Text>
);
// @ts-expect-error a bare signal has no receiving component at the Pibbl root
pibbl(document.createElement('canvas'), reactiveNode);
void signalValuedPrimitiveInputs;
void gauge;
void exactSignal;
void nestedExactSignal;
void optionalExactSignal;
void nestedOptionalExactSignal;
void nestedPaddingSignal;
void publicNodeInput;
void signalValuedChildren;
void invalidNestedTextSignal;

const numericOutput = signal(0);
const objectOutput = signal({ x: 0 });
const objectInterpolator: PibblInterpolator<{ x: number }> = (
  from,
  to,
  progress,
) => ({ x: from.x + (to.x - from.x) * progress });
const tweenDefinition: PibblAnimationDefinition<number> = tween({
  to: 10,
  duration: 100,
  easing: easing.easeOut,
});
const springDefinition: PibblAnimationDefinition<number> = spring({ to: 20 });
const objectDefinition = tween({
  to: { x: 10 },
  duration: 100,
  interpolate: objectInterpolator,
});
const keyframeDefinition = keyframes({ values: [0, 5, 10], duration: 200 });
const customDefinition = defineAnimation<number>({
  duration: 50,
  sample: ({ progress }) => progress,
});
const stepperDefinition = stepper<{ value: number }, number>({
  stepMilliseconds: 10,
  initial: value => ({ value }),
  step: state => ({ value: state.value + 1 }),
  read: state => state.value,
});
const animationProgram: PibblAnimationProgram = sequence(
  parallel(
    drive(numericOutput, tweenDefinition),
    drive(objectOutput, objectDefinition),
  ),
  marker('halfway'),
  drive(numericOutput, keyframeDefinition),
  wait(10),
  repeat(drive(numericOutput, springDefinition), {
    iterations: 2,
    direction: 'alternate',
  }),
  drive(numericOutput, customDefinition),
  drive(numericOutput, stepperDefinition),
);
const easingValue: PibblEasing = easing.linear;
const repeatDirection: PibblAnimationRepeatDirection = 'alternate-reverse';
const repeatOptions: PibblAnimationRepeatOptions = {
  iterations: 2,
  direction: repeatDirection,
};
const tweenOptions: PibblTweenOptions<number> = { to: 1, duration: 10 };
const keyframesOptions: PibblKeyframesOptions<number> = {
  values: [0, 1],
  duration: 10,
};
const oneValueKeyframesOptions: PibblKeyframesOptions<number> = {
  // @ts-expect-error public keyframes require at least two values
  values: [0],
  duration: 10,
};
void oneValueKeyframesOptions;
const springOptions: PibblSpringOptions = { to: 1 };
const sampleInput: PibblAnimationSampleInput<number> = {
  initialValue: 0,
  localTime: 5,
  progress: 0.5,
};
const animationOptions: PibblAnimationOptions<number> = {
  duration: 10,
  sample: input => input.progress,
};
const stepperOptions: PibblStepperOptions<{ value: number }, number> = {
  stepMilliseconds: 10,
  initial: value => ({ value }),
  step: state => state,
  read: state => state.value,
};
const playbackOptions: PibblPlaybackOptions = { autoplay: false };
const playbackStatus: PibblPlaybackStatus = 'idle';
const playbackEvent = null as PibblPlaybackEvent | null;
const tweenTransitionOptions: PibblTweenAnimatedValueOptions<{ x: number }> = {
  type: 'tween',
  duration: 100,
  interpolate: objectInterpolator,
};
const springTransitionOptions: PibblSpringAnimatedValueOptions = { type: 'spring' };

function AnimationHookScene(): PibblNode {
  const player: PibblPlayback = usePlayback(animationProgram, playbackOptions);
  const tweened = useAnimatedValue({ x: 10 }, tweenTransitionOptions);
  const sprung = useAnimatedValue(10, springTransitionOptions);
  return <Text>{`${player.status.get()}:${tweened.get().x}:${sprung.get()}`}</Text>;
}

// @ts-expect-error spring values are number-only
spring({ to: 'done' });
const numberDefinition = tween({ to: 10, duration: 100 });
// @ts-expect-error a numeric definition cannot write an object signal
drive(objectOutput, numberDefinition);
type CoreExports = typeof import('@pibbl/core');
// @ts-expect-error no free playback function is exported
type FreePlay = CoreExports['play'];

// @ts-expect-error readonly signals do not expose writes
readonlyCount.set(2);
// @ts-expect-error Pibbl style accepts resolved numbers, not signal containers
const badStyle: RectStyle = { left: writableCount, width: 10, height: 10 };
// @ts-expect-error computed values are readonly
computed(() => writableCount.get() * 2).update(value => value + 1);

const maybeSignal: unknown = readonlyCount;
if (isSignal(maybeSignal)) {
  const narrowedSignal: Signal<unknown> = maybeSignal;
  void narrowedSignal.get();
}

function SignalHookScene(): PibblNode {
  const label = useSignal('hook value');
  return <Text>{label.get()}</Text>;
}
const signalHookComponent: PibblComponent<Record<string, never>> = SignalHookScene;

function ComputedHookScene({ scale }: { scale: number }): PibblNode {
  const origin = useConst(() => 10);
  const source = useSignal(2);
  const value: Signal<number> = useComputed(
    () => origin + source.get() * scale,
    [scale],
    { debugName: 'public computed hook' },
  );
  return <Text>{value}</Text>;
}
const computedHookComponent: PibblComponent<{ scale: number }> =
  ComputedHookScene;

function ReactionHookScene({ label }: { label: string }): PibblNode {
  const source = useSignal(1);
  const options: PibblReactionOptions = { debugName: label };
  useReaction(() => {
    source.get();
    return () => undefined;
  }, [label], options);
  return <Text>{source}</Text>;
}
const reactionHookComponent: PibblComponent<{ label: string }> =
  ReactionHookScene;

void importedFinalVocabulary;
void (null as unknown as RemovedHookVocabulary);
void component;
void element;
void pointerEventsVocabulary;
void controller;
void untrackedCount;
void callbackValue;
void animationProgram;
void easingValue;
void repeatOptions;
void tweenOptions;
void keyframesOptions;
void springOptions;
void sampleInput;
void animationOptions;
void stepperOptions;
void playbackStatus;
void playbackEvent;
void AnimationHookScene;
void (null as unknown as FreePlay);
void badStyle;
void signalHookComponent;
void computedHookComponent;
void reactionHookComponent;
