import {
  Absolute,
  Clip,
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
  KeyboardNavigation,
  Layer,
  Line,
  measureElement,
  Overlay,
  Path,
  Rectangle,
  SvgPath,
  Text,
  VerticalLine,
  type CRCComponent,
  type CRCController,
  type CRCElement,
  type CRCNode,
} from '@crc/core';

const importedFinalVocabulary = {
  Absolute,
  Clip,
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
  KeyboardNavigation,
  Layer,
  Line,
  measureElement,
  Overlay,
  Path,
  Rectangle,
  SvgPath,
  Text,
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

void importedFinalVocabulary;
void component;
void element;
void controller;
