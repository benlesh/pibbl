import {
  useConst,
  Flex,
  Rectangle,
  Text,
  useCanvasContext,
  useReaction,
  type PibblNode,
  signal,
  useLayoutBox,
  type BoxStyle,
  type FlexItemStyle,
} from "@pibbl/core";

function createWasmYogaMigrationExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  // Recorded Yoga 3.2.1 geometry; generated/checked by tooling/layout-yoga-rehearsal.mjs.
  // BEGIN YOGA REFERENCE
  const fixtureCases = [
  {
    "name": "grow",
    "width": 300,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 144,
        "height": 80
      },
      {
        "x": 156,
        "y": 0,
        "width": 144,
        "height": 80
      }
    ]
  },
  {
    "name": "cap",
    "width": 300,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 80,
        "height": 80
      },
      {
        "x": 92,
        "y": 0,
        "width": 208,
        "height": 80
      }
    ]
  },
  {
    "name": "shrink",
    "width": 220,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 120,
        "height": 80
      },
      {
        "x": 132,
        "y": 0,
        "width": 88,
        "height": 80
      }
    ]
  },
  {
    "name": "rectangle-shrink",
    "width": 100,
    "height": 100,
    "gap": 0,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 50,
        "height": 80
      },
      {
        "x": 50,
        "y": 0,
        "width": 50,
        "height": 80
      }
    ]
  },
  {
    "name": "rectangle-percent-content-box",
    "width": 200,
    "height": 100,
    "gap": 0,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 110,
        "height": 100
      },
      {
        "x": 110,
        "y": 0,
        "width": 90,
        "height": 100
      }
    ]
  },
  {
    "name": "column-grow",
    "width": 100,
    "height": 100,
    "gap": 12,
    "flexDirection": "column",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 80,
        "height": 44
      },
      {
        "x": 0,
        "y": 56,
        "width": 80,
        "height": 44
      }
    ]
  },
  {
    "name": "column-cap",
    "width": 100,
    "height": 100,
    "gap": 12,
    "flexDirection": "column",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 80,
        "height": 30
      },
      {
        "x": 0,
        "y": 42,
        "width": 80,
        "height": 58
      }
    ]
  },
  {
    "name": "column-shrink",
    "width": 100,
    "height": 100,
    "gap": 12,
    "flexDirection": "column",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 80,
        "height": 60
      },
      {
        "x": 0,
        "y": 72,
        "width": 80,
        "height": 28
      }
    ]
  },
  {
    "name": "row-reverse-cap",
    "width": 300,
    "height": 100,
    "gap": 12,
    "flexDirection": "row-reverse",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 220,
        "y": 0,
        "width": 80,
        "height": 80
      },
      {
        "x": 0,
        "y": 0,
        "width": 208,
        "height": 80
      }
    ]
  },
  {
    "name": "column-reverse-cap",
    "width": 100,
    "height": 100,
    "gap": 12,
    "flexDirection": "column-reverse",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 70,
        "width": 80,
        "height": 30
      },
      {
        "x": 0,
        "y": 0,
        "width": 80,
        "height": 58
      }
    ]
  },
  {
    "name": "row-wrap",
    "width": 150,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "wrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 60,
        "height": 20
      },
      {
        "x": 72,
        "y": 0,
        "width": 60,
        "height": 20
      },
      {
        "x": 0,
        "y": 32,
        "width": 60,
        "height": 20
      }
    ]
  },
  {
    "name": "row-wrap-reverse",
    "width": 150,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "wrap-reverse",
    "boxes": [
      {
        "x": 0,
        "y": 80,
        "width": 60,
        "height": 20
      },
      {
        "x": 72,
        "y": 80,
        "width": 60,
        "height": 20
      },
      {
        "x": 0,
        "y": 48,
        "width": 60,
        "height": 20
      }
    ]
  },
  {
    "name": "border-box-floor-bounds",
    "width": 160,
    "height": 80,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 20,
        "height": 60
      },
      {
        "x": 32,
        "y": 0,
        "width": 100,
        "height": 60
      }
    ]
  },
  {
    "name": "border-box-percentage",
    "width": 200,
    "height": 100,
    "gap": 0,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 110,
        "height": 60
      },
      {
        "x": 110,
        "y": 0,
        "width": 90,
        "height": 60
      }
    ]
  },
  {
    "name": "border-box-asymmetric-row",
    "width": 200,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 54,
        "height": 62
      },
      {
        "x": 66,
        "y": 0,
        "width": 54,
        "height": 62
      }
    ]
  },
  {
    "name": "border-box-asymmetric-column",
    "width": 100,
    "height": 160,
    "gap": 12,
    "flexDirection": "column",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 54,
        "height": 62
      },
      {
        "x": 0,
        "y": 74,
        "width": 54,
        "height": 62
      }
    ]
  },
  {
    "name": "zero-fractional-grow",
    "width": 112,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 25,
        "height": 80
      },
      {
        "x": 37,
        "y": 0,
        "width": 75,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 0,
        "height": 80,
        "flexBasis": 0,
        "flexGrow": 0.5,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      },
      {
        "width": 0,
        "height": 80,
        "flexBasis": 0,
        "flexGrow": 1.5,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ]
  },
  {
    "name": "fractional-shrink",
    "width": 112,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 65,
        "height": 80
      },
      {
        "x": 77,
        "y": 0,
        "width": 35,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 0.5,
        "minWidth": 0,
        "maxWidth": 1000000
      },
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 1.5,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ]
  },
  {
    "name": "grow-freeze-release",
    "width": 312,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 110,
        "height": 80
      },
      {
        "x": 122,
        "y": 0,
        "width": 190,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 100,
        "height": 80,
        "flexBasis": 100,
        "flexGrow": 1,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 110
      },
      {
        "width": 100,
        "height": 80,
        "flexBasis": 100,
        "flexGrow": 1,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ]
  },
  {
    "name": "shrink-freeze-release",
    "width": 112,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 70,
        "height": 80
      },
      {
        "x": 82,
        "y": 0,
        "width": 30,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 1,
        "minWidth": 70,
        "maxWidth": 1000000
      },
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 3,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ]
  },
  {
    "name": "large-finite-differential",
    "width": 312,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 80
      },
      {
        "x": 112,
        "y": 0,
        "width": 200,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 0,
        "height": 80,
        "flexBasis": 0,
        "flexGrow": 1e+30,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      },
      {
        "width": 0,
        "height": 80,
        "flexBasis": 0,
        "flexGrow": 2e+30,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ]
  },
  {
    "name": "subunit-zero-grow",
    "width": 112,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 25,
        "height": 80
      },
      {
        "x": 37,
        "y": 0,
        "width": 25,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 0,
        "height": 80,
        "flexBasis": 0,
        "flexGrow": 0.25,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      },
      {
        "width": 0,
        "height": 80,
        "flexBasis": 0,
        "flexGrow": 0.25,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ]
  },
  {
    "name": "subunit-shrink-policy",
    "width": 112,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 50,
        "height": 80
      },
      {
        "x": 62,
        "y": 0,
        "width": 50,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 0.25,
        "minWidth": 0,
        "maxWidth": 1000000
      },
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 0.25,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ],
    "classification": "preserved-css-partial-shrink",
    "pibblBoxes": [
      {
        "x": 0,
        "y": 0,
        "width": 65,
        "height": 80
      },
      {
        "x": 77,
        "y": 0,
        "width": 65,
        "height": 80
      }
    ],
    "comparisonLabel": "CSS partial shrink: Yoga50/50 vs Pibbl65/65"
  },
  {
    "name": "initial-freeze-grow-policy",
    "width": 112,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 10,
        "height": 80
      },
      {
        "x": 22,
        "y": 0,
        "width": 43.3333,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 20,
        "height": 80,
        "flexBasis": 20,
        "flexGrow": 0.25,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 10
      },
      {
        "width": 20,
        "height": 80,
        "flexBasis": 20,
        "flexGrow": 0.25,
        "flexShrink": 0,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ],
    "classification": "css-initial-freeze-grow",
    "comparisonLabel": "CSS freeze grow: Yoga43.3333 vs Pibbl37.5",
    "pibblBoxes": [
      {
        "x": 0,
        "y": 0,
        "width": 10,
        "height": 80
      },
      {
        "x": 22,
        "y": 0,
        "width": 37.5,
        "height": 80
      }
    ]
  },
  {
    "name": "initial-freeze-shrink-policy",
    "width": 112,
    "height": 100,
    "gap": 12,
    "flexDirection": "row",
    "flexWrap": "nowrap",
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 90,
        "height": 80
      },
      {
        "x": 102,
        "y": 0,
        "width": 10,
        "height": 80
      }
    ],
    "itemStyles": [
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 0.25,
        "minWidth": 90,
        "maxWidth": 1000000
      },
      {
        "width": 80,
        "height": 80,
        "flexBasis": 80,
        "flexGrow": 0,
        "flexShrink": 0.25,
        "minWidth": 0,
        "maxWidth": 1000000
      }
    ],
    "classification": "css-initial-freeze-shrink",
    "comparisonLabel": "CSS freeze shrink: Yoga10 vs Pibbl62.5",
    "pibblBoxes": [
      {
        "x": 0,
        "y": 0,
        "width": 90,
        "height": 80
      },
      {
        "x": 102,
        "y": 0,
        "width": 62.5,
        "height": 80
      }
    ]
  }
] as const;
  // END YOGA REFERENCE
  const index = signal(0);
  const ink = signal("#19375b");
  const selected = signal("none");
  const actual = new Map<string, string>();
  function Panel({
    name,
    column = false,
    wrapped = false,
    style: _specifiedStyle,
  }: {
    name: string;
    column?: boolean;
    wrapped?: boolean;
    style: BoxStyle & FlexItemStyle;
  }) {
    const box = useLayoutBox();
    const compact = column || wrapped || box.width < 50;
    actual.set(name, `${box.width} × ${box.height}`);
    return (
      <>
        <Rectangle
          style={{
            width: box.width,
            height: box.height,
            fill: name === "A" ? "#d6e3db" : "#e1dbca",
            cursor: "pointer",
          }}
          onClick={() => selected.set(name)}
        />
        <Text
          pointerEvents="none"
          style={{ left: compact ? 4 : 12, top: compact ? 4 : 14, font: compact ? "bold 10px monospace" : "bold 14px monospace", fill: ink }}
        >
          {wrapped ? `${name} ${box.width}×${box.height}` : name}
        </Text>
        {!wrapped && box.width >= 50 && <Text
          pointerEvents="none"
          style={{ left: column ? 4 : 12, top: column ? 16 : 38, font: column ? box.width < 80 ? "7px monospace" : "10px monospace" : "12px monospace", fill: ink }}
        >{column ? `${box.width} × ${box.height} px` : `${box.width} px`}</Text>}
      </>
    );
  }
  function Workspace() {
    const fixture = fixtureCases[index.get()];
    const itemStyles = "itemStyles" in fixture ? fixture.itemStyles : undefined;
    const wrapped = fixture.flexWrap !== "nowrap";
    const boxed = fixture.name.startsWith("border-box-");
    const floor = fixture.name === "border-box-floor-bounds";
    const percentBox = fixture.name === "border-box-percentage";
    const asymmetricBorder = fixture.name.startsWith("border-box-asymmetric-");
    const column = fixture.flexDirection.startsWith("column");
    const compact = column || wrapped;
    const shrinking = fixture.name === "shrink" || fixture.name === "column-shrink";
    const rectangles = fixture.name.startsWith("rectangle-");
    const padded = fixture.name === "rectangle-percent-content-box";
    return (
      <>
        <Text
          style={{
            left: 28,
            top: 194,
            font: "bold 16px sans-serif",
            fill: "#19375b",
          }}
        >
          Before · Yoga 3.2.1 reference
        </Text>
        <Text
          style={{
            left: 392,
            top: 194,
            font: "bold 16px sans-serif",
            fill: "#19375b",
          }}
        >
          After · public Pibbl
        </Text>
        {fixture.boxes.map((box, i) => (
          <>
            <Rectangle
              style={{
                left: 28 + box.x,
                top: 240 + box.y,
                width: box.width,
                height: box.height,
                fill: i === 0 ? "#d6e3db" : "#e1dbca",
              }}
            />
            <Text
              pointerEvents="none"
              style={{
                left: 28 + box.x + (compact || box.width < 50 ? 4 : 12),
                top: 240 + box.y + (compact || box.width < 50 ? 4 : 14),
                font: compact || box.width < 50 ? "bold 10px monospace" : "bold 14px monospace",
                fill: "#19375b",
              }}
            >
              {wrapped ? `${String.fromCharCode(65+i)} ${box.width}×${box.height}` : String.fromCharCode(65+i)}
            </Text>
            {!wrapped && box.width >= 50 && <Text
              pointerEvents="none"
              style={{
                left: 28 + box.x + (column ? 4 : 12),
                top: 240 + box.y + (column ? 16 : 38),
                font: column ? box.width < 80 ? "7px monospace" : "10px monospace" : "12px monospace",
                fill: "#19375b",
              }}
            >{column ? `${box.width} × ${box.height} px` : `${box.width} px`}</Text>}
          </>
        ))}
        <Flex
          style={{
            left: 392,
            top: 240,
            width: fixture.width,
            height: fixture.height,
            flexDirection: fixture.flexDirection,
            flexWrap: fixture.flexWrap,
            alignContent: "flex-start",
            alignItems: "flex-start",
            gap: fixture.gap,
          }}
        >
          {itemStyles ? itemStyles.map((style, index) => <Panel key={index} name={String.fromCharCode(65+index)} style={style} />) : rectangles ? <>
            <Rectangle onClick={() => selected.set("A")} style={{
              width: 80, height: 80, flexBasis: padded ? "70%" : "auto", flexShrink: 1,
              minWidth: padded ? 90 : undefined, padding: padded ? 10 : 0,
              fill: "#d6e3db", cursor: "pointer",
            }} />
            <Rectangle onClick={() => selected.set("B")} style={{
              width: 80, height: 80, flexBasis: padded ? "70%" : "auto", flexShrink: 1,
              padding: padded ? 10 : 0, fill: "#e1dbca", cursor: "pointer",
            }} />
          </> : <>
          <Panel
            name="A"
            column={column}
            wrapped={wrapped}
            style={{
              flexBasis: asymmetricBorder ? column ? 62 : 54 : percentBox ? "70%" : floor ? 8 : column ? shrinking ? 80 : 20 : shrinking ? 180 : 60,
              flexGrow: boxed || wrapped || shrinking ? 0 : 1,
              flexShrink: floor || asymmetricBorder ? 0 : 1,
              boxSizing: boxed ? "border-box" : undefined,
              padding: asymmetricBorder ? { left: 3, right: 5, top: 7, bottom: 11 } : boxed ? 10 : undefined,
              borderWidth: asymmetricBorder ? { left: 2, right: 4, top: 6, bottom: 8 } : undefined,
              minWidth: percentBox ? 110 : column ? undefined : shrinking ? 120 : 0,
              minHeight: column ? shrinking ? 60 : 0 : undefined,
              maxHeight: fixture.name === "column-cap" || fixture.name === "column-reverse-cap" ? 30 : undefined,
              width: column ? asymmetricBorder ? 54 : 80 : undefined,
              maxWidth: floor ? 8 : percentBox ? "60%" : fixture.name === "cap" || fixture.name === "row-reverse-cap" ? 80 : undefined,
              height: asymmetricBorder ? column ? undefined : 62 : percentBox ? "60%" : boxed ? 60 : wrapped ? 20 : 80,
            }}
          />
          <Panel
            name="B"
            column={column}
            wrapped={wrapped}
            style={{
              flexBasis: asymmetricBorder ? column ? 62 : 54 : percentBox ? "70%" : floor ? 80 : column ? shrinking ? 80 : 20 : shrinking ? 180 : 60,
              flexGrow: boxed || wrapped || shrinking ? 0 : 1,
              flexShrink: floor || asymmetricBorder ? 0 : 1,
              boxSizing: boxed ? "border-box" : undefined,
              padding: asymmetricBorder ? { left: 3, right: 5, top: 7, bottom: 11 } : boxed ? 10 : undefined,
              borderWidth: asymmetricBorder ? { left: 2, right: 4, top: 6, bottom: 8 } : undefined,
              minWidth: floor ? 100 : column ? undefined : 0,
              minHeight: column ? 0 : undefined,
              maxWidth: floor ? 110 : undefined,
              width: column ? asymmetricBorder ? 54 : 80 : undefined,
              height: asymmetricBorder ? column ? undefined : 62 : percentBox ? "60%" : boxed ? 60 : wrapped ? 20 : 80,
            }}
          />
          {wrapped && <Panel name="C" wrapped style={{ width: 60, height: 20, flexBasis: 60, flexGrow: 0, flexShrink: 1, minWidth: 0 }} />}
          </>}
        </Flex>
        <Text
          style={{
            left: 28,
            top: 410,
            font: "12px monospace",
            fill: "#19375b",
          }}
        >{`${"comparisonLabel" in fixture ? fixture.comparisonLabel : fixture.name} · parent ${fixture.width} × ${fixture.height} px · ${fixture.flexDirection} · gap ${fixture.gap} px`}</Text>
      </>
    );
  }
  node = (
    <>
      <Rectangle style={{ width: 760, height: 460, fill: "#f3f0e8" }} />
      <Text
        style={{
          left: 28,
          top: 24,
          font: "bold 24px sans-serif",
          fill: "#19375b",
        }}
      >
        Yoga → Pibbl · bounded rehearsal
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        25 recorded cases: 22 matches and three classified CSS differences.
      </Text>
      <Text
        style={{ left: 28, top: 100, font: "13px sans-serif", fill: "#475569" }}
      >
        Explicit axes, wrapping, sizing, borders and factors; left is recorded Yoga, not a live runtime.
      </Text>
      <Rectangle
        style={{
          left: 28,
          top: 140,
          width: 220,
          height: 36,
          fill: "#19375b",
          cursor: "pointer",
        }}
        onClick={() =>
          index.update((value) => (value + 1) % fixtureCases.length)
        }
      />
      <Text
        pointerEvents="none"
        style={{ left: 40, top: 150, font: "14px sans-serif", fill: "#ffffff" }}
      >
        Next case + resize
      </Text>
      <Rectangle
        style={{
          left: 264,
          top: 140,
          width: 180,
          height: 36,
          fill: "#6e3e79",
          cursor: "pointer",
        }}
        onClick={() =>
          ink.update((value) => (value === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Text
        pointerEvents="none"
        style={{
          left: 276,
          top: 150,
          font: "14px sans-serif",
          fill: "#ffffff",
        }}
      >
        Paint only
      </Text>
      <Workspace />
      <Text
        style={{
          left: 28,
          top: 440,
          width: 700,
          wrap: true,
          font: "11px sans-serif",
          fill: "#475569",
        }}
      >
        Finite recorded cases only; general CSS/Yoga parity and font migration remain unproven.
      </Text>
    </>
  );
  const read = (
    globalThis as typeof globalThis & {
      __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number>;
    }
  ).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement("pre");
  panel.style.cssText =
    "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  const refresh = () => {
    const fixture = fixtureCases[index.get()];
    panel.textContent = `${
      read
        ? "EXPERIMENTAL WASM · " +
          Object.entries(read())
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")
        : "Normal JS build"
    }\nYoga 3.2.1 · 042f5013152e · ${fixture.name}${"comparisonLabel" in fixture ? " · "+fixture.comparisonLabel : ""} · actual A: ${fixture.name.startsWith("rectangle-") ? "direct Canvas boxes" : `${actual.get("A")} px · B: ${actual.get("B")} px`} · selected: ${selected.get()}`;
  };
  refresh();
  const timer = window.setInterval(refresh, 200);
  return {
    node,
    ...{
      dispose() {
        window.clearInterval(timer);
        panel.remove();
      },
    },
  };
}

export function WasmYogaMigrationExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmYogaMigrationExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
