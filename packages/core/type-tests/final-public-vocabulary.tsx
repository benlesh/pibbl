import {
  Absolute,
  batch,
  Clip,
  computed,
  createElement,
  crc,
  useCanvasContext,
  useComputed,
  useConst,
  useCursor,
  useEvent,
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
  useTransition,
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
  track,
  tween,
  untracked,
  VerticalLine,
  wait,
  marker,
  type CRCAnimationDefinition,
  type CRCAnimationOptions,
  type CRCAnimationProgram,
  type CRCAnimationRepeatDirection,
  type CRCAnimationRepeatOptions,
  type CRCAnimationSampleInput,
  type CRCComponent,
  type CRCController,
  type CRCEventHandler,
  type CRCElement,
  type CRCEasing,
  type CRCInterpolator,
  type CRCKeyframesOptions,
  type CRCNode,
  type CRCNodeInput,
  type CRCPlayback,
  type CRCPlaybackEvent,
  type CRCPlaybackOptions,
  type CRCPlaybackStatus,
  type CRCReactionOptions,
  type RectStyle,
  type CRCSpringOptions,
  type CRCSpringTransitionOptions,
  type CRCStepperOptions,
  type CRCTweenOptions,
  type CRCTweenTransitionOptions,
  type Signal,
  type SignalEquals,
  type SignalOptions,
  type SignalValue,
  type CRCTextInput,
  type WritableSignal,
} from '@crc/core';

// Removed hooks have no compatibility export from the package root.
// @ts-expect-error useState was replaced by useSignal
import { useState as removedUseState } from '@crc/core';
// @ts-expect-error StateUpdater was removed with useState
import type { StateUpdater as RemovedStateUpdater } from '@crc/core';
// @ts-expect-error useMemo was replaced by useConst and useComputed
import { useMemo as removedUseMemo } from '@crc/core';
// @ts-expect-error useWhenChanged was replaced by useReaction
import { useWhenChanged as removedUseWhenChanged } from '@crc/core';

const importedFinalVocabulary = {
  Absolute,
  batch,
  Clip,
  computed,
  createElement,
  crc,
  useCanvasContext,
  useComputed,
  useConst,
  useCursor,
  useEvent,
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
  useTransition,
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
  track,
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

function FinalVocabularyScene(): CRCNode {
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

const component: CRCComponent<Record<string, never>> = FinalVocabularyScene;
const element: CRCElement<any> = createElement(Rectangle, {
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
const controller = null as CRCController | null;
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
const reactiveHandler = signal<CRCEventHandler<'click'>>(() => {});
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
const reactiveNode = signal<CRCNode>(
  <Rectangle style={{ width: 10, height: 10 }} />,
);
const publicNodeInput: CRCNodeInput = reactiveNode;
const publicTextInput: CRCTextInput = ['Value: ', reactiveLabel];
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
// @ts-expect-error a bare signal has no receiving component at the CRC root
crc(document.createElement('canvas'), reactiveNode);
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
const objectInterpolator: CRCInterpolator<{ x: number }> = (
  from,
  to,
  progress,
) => ({ x: from.x + (to.x - from.x) * progress });
const tweenDefinition: CRCAnimationDefinition<number> = tween({
  to: 10,
  duration: 100,
  easing: easing.easeOut,
});
const springDefinition: CRCAnimationDefinition<number> = spring({ to: 20 });
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
const animationProgram: CRCAnimationProgram = sequence(
  parallel(
    track(numericOutput, tweenDefinition),
    track(objectOutput, objectDefinition),
  ),
  marker('halfway'),
  track(numericOutput, keyframeDefinition),
  wait(10),
  repeat(track(numericOutput, springDefinition), {
    iterations: 2,
    direction: 'alternate',
  }),
  track(numericOutput, customDefinition),
  track(numericOutput, stepperDefinition),
);
const easingValue: CRCEasing = easing.linear;
const repeatDirection: CRCAnimationRepeatDirection = 'alternate-reverse';
const repeatOptions: CRCAnimationRepeatOptions = {
  iterations: 2,
  direction: repeatDirection,
};
const tweenOptions: CRCTweenOptions<number> = { to: 1, duration: 10 };
const keyframesOptions: CRCKeyframesOptions<number> = {
  values: [0, 1],
  duration: 10,
};
const oneValueKeyframesOptions: CRCKeyframesOptions<number> = {
  // @ts-expect-error public keyframes require at least two values
  values: [0],
  duration: 10,
};
void oneValueKeyframesOptions;
const springOptions: CRCSpringOptions = { to: 1 };
const sampleInput: CRCAnimationSampleInput<number> = {
  initialValue: 0,
  localTime: 5,
  progress: 0.5,
};
const animationOptions: CRCAnimationOptions<number> = {
  duration: 10,
  sample: input => input.progress,
};
const stepperOptions: CRCStepperOptions<{ value: number }, number> = {
  stepMilliseconds: 10,
  initial: value => ({ value }),
  step: state => state,
  read: state => state.value,
};
const playbackOptions: CRCPlaybackOptions = { autoplay: false };
const playbackStatus: CRCPlaybackStatus = 'idle';
const playbackEvent = null as CRCPlaybackEvent | null;
const tweenTransitionOptions: CRCTweenTransitionOptions<{ x: number }> = {
  type: 'tween',
  duration: 100,
  interpolate: objectInterpolator,
};
const springTransitionOptions: CRCSpringTransitionOptions = { type: 'spring' };

function AnimationHookScene(): CRCNode {
  const player: CRCPlayback = usePlayback(animationProgram, playbackOptions);
  const tweened = useTransition({ x: 10 }, tweenTransitionOptions);
  const sprung = useTransition(10, springTransitionOptions);
  return <Text>{`${player.status.get()}:${tweened.get().x}:${sprung.get()}`}</Text>;
}

// @ts-expect-error spring values are number-only
spring({ to: 'done' });
const numberDefinition = tween({ to: 10, duration: 100 });
// @ts-expect-error a numeric definition cannot write an object signal
track(objectOutput, numberDefinition);
type CoreExports = typeof import('@crc/core');
// @ts-expect-error no free playback function is exported
type FreePlay = CoreExports['play'];

// @ts-expect-error readonly signals do not expose writes
readonlyCount.set(2);
// @ts-expect-error CRC style accepts resolved numbers, not signal containers
const badStyle: RectStyle = { left: writableCount, width: 10, height: 10 };
// @ts-expect-error computed values are readonly
computed(() => writableCount.get() * 2).update(value => value + 1);

const maybeSignal: unknown = readonlyCount;
if (isSignal(maybeSignal)) {
  const narrowedSignal: Signal<unknown> = maybeSignal;
  void narrowedSignal.get();
}

function SignalHookScene(): CRCNode {
  const label = useSignal('hook value');
  return <Text>{label.get()}</Text>;
}
const signalHookComponent: CRCComponent<Record<string, never>> = SignalHookScene;

function ComputedHookScene({ scale }: { scale: number }): CRCNode {
  const origin = useConst(() => 10);
  const source = useSignal(2);
  const value: Signal<number> = useComputed(
    () => origin + source.get() * scale,
    [scale],
    { debugName: 'public computed hook' },
  );
  return <Text>{value}</Text>;
}
const computedHookComponent: CRCComponent<{ scale: number }> =
  ComputedHookScene;

function ReactionHookScene({ label }: { label: string }): CRCNode {
  const source = useSignal(1);
  const options: CRCReactionOptions = { debugName: label };
  useReaction(() => {
    source.get();
    return () => undefined;
  }, [label], options);
  return <Text>{source}</Text>;
}
const reactionHookComponent: CRCComponent<{ label: string }> =
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
