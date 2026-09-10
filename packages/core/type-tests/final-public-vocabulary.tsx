import {
  Absolute,
  Clip,
  computed,
  createElement,
  crc,
  crcCanvasContext,
  crcCursor,
  crcEvent,
  crcEventListener,
  crcEventTarget,
  crcLayoutBox,
  crcLinePath,
  crcMemo,
  crcRectPath,
  crcRef,
  crcSignal,
  crcState,
  crcSvgPath,
  crcWhenChanged,
  definePrimitive,
  Flex,
  Flow,
  FocusManagement,
  Fragment,
  Grid,
  Group,
  HorizontalLine,
  Image,
  isSignal,
  KeyboardNavigation,
  Layer,
  Line,
  measureElement,
  Overlay,
  Path,
  Rectangle,
  signal,
  SvgPath,
  Text,
  untracked,
  VerticalLine,
  type CRCComponent,
  type CRCController,
  type CRCElement,
  type CRCNode,
  type RectStyle,
  type Signal,
  type SignalEquals,
  type SignalOptions,
  type WritableSignal,
} from '@crc/core';

const importedFinalVocabulary = {
  Absolute,
  Clip,
  computed,
  createElement,
  crc,
  crcCanvasContext,
  crcCursor,
  crcEvent,
  crcEventListener,
  crcEventTarget,
  crcLayoutBox,
  crcLinePath,
  crcMemo,
  crcRectPath,
  crcRef,
  crcSignal,
  crcState,
  crcSvgPath,
  crcWhenChanged,
  definePrimitive,
  Flex,
  Flow,
  FocusManagement,
  Fragment,
  Grid,
  Group,
  HorizontalLine,
  Image,
  isSignal,
  KeyboardNavigation,
  Layer,
  Line,
  measureElement,
  Overlay,
  Path,
  Rectangle,
  signal,
  SvgPath,
  Text,
  untracked,
  VerticalLine,
};

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

// @ts-expect-error readonly signals do not expose writes
readonlyCount.set(2);
// @ts-expect-error CRC style accepts resolved numbers, not signal containers
const badStyle: RectStyle = { x: writableCount, width: 10, height: 10 };
// @ts-expect-error computed values are readonly
computed(() => writableCount.get() * 2).update(value => value + 1);

const maybeSignal: unknown = readonlyCount;
if (isSignal(maybeSignal)) {
  const narrowedSignal: Signal<unknown> = maybeSignal;
  void narrowedSignal.get();
}

function SignalHookScene(): CRCNode {
  const label = crcSignal('hook value');
  return <Text>{label.get()}</Text>;
}
const signalHookComponent: CRCComponent<Record<string, never>> = SignalHookScene;

void importedFinalVocabulary;
void component;
void element;
void controller;
void untrackedCount;
void callbackValue;
void badStyle;
void signalHookComponent;
