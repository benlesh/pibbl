import {
  useConst,
  computed,
  definePrimitive,
  type SystemStyle,
  type FlexMargin,
  type FlexStyle,
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

interface YogaMigrationBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Recorded fixture data accepted by the bounded Yoga migration example. */
interface YogaMigrationFixture {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly flexDirection: NonNullable<FlexStyle["flexDirection"]>;
  readonly flexWrap: NonNullable<FlexStyle["flexWrap"]>;
  readonly boxes: readonly YogaMigrationBox[];
  readonly containerStyle?: Readonly<FlexStyle>;
  readonly itemStyles?: readonly Readonly<FlexStyle>[];
  readonly ownerLeafStyles?: readonly Readonly<FlexStyle>[];
  readonly nestedOwnerStyle?: Readonly<FlexStyle>;
  readonly nestedItemStyles?: readonly Readonly<FlexStyle>[];
  readonly innerStyle?: Readonly<FlexStyle>;
  readonly footerStyle?: Readonly<FlexStyle>;
  readonly layoutDirection?: "ltr" | "rtl";
  readonly textValue?: string;
  readonly comparisonLabel?: string;
  readonly classification?: string;
  readonly pibblBoxes?: readonly YogaMigrationBox[];
  readonly contentBoxes?: readonly YogaMigrationBox[];
  readonly nestedBoxes?: readonly YogaMigrationBox[];
  readonly nestedCrossBoxes?: readonly YogaMigrationBox[];
  readonly nestedDecoratedBoxes?: readonly YogaMigrationBox[];
  readonly nestedDecoratedMaxBoxes?: readonly YogaMigrationBox[];
  readonly nestedDecoratedColumnMaxBoxes?: readonly YogaMigrationBox[];
  readonly nestedDecoratedColumnMinBoxes?: readonly YogaMigrationBox[];
  readonly intrinsicNestedBoxes?: readonly YogaMigrationBox[];
  readonly intrinsicLeafStyles?: readonly Readonly<FlexStyle>[];
  readonly intrinsicFixture?: boolean;
  readonly directionMatrixFixture?: boolean;
  readonly autoMarginFixture?: boolean;
  readonly autoWrappedMarginFixture?: boolean;
  readonly autoCrossMarginFixture?: boolean;
  readonly autoCrossDirectionFixture?: boolean;
  readonly autoMainDirectionFixture?: boolean;
  readonly autoShorthandMarginFixture?: boolean;
  readonly autoOpposingMarginFixture?: boolean;
  readonly textCrossAutoFixture?: boolean;
  readonly customCrossAutoFixture?: boolean;
  readonly ownerCrossAutoFixture?: boolean;
  readonly roundingFixture?: boolean;
  readonly nestedCrossMinFixture?: boolean;
  readonly nestedDecoratedCrossMinFixture?: boolean;
  readonly nestedDecoratedCrossMaxFixture?: boolean;
  readonly nestedDecoratedColumnCrossMaxFixture?: boolean;
  readonly nestedDecoratedColumnCrossMinFixture?: boolean;
  readonly customColumnMeasureFixture?: boolean;
  readonly relativeStaticFixture?: boolean;
  readonly decoratedRelativeStaticFixture?: boolean;
  readonly absoluteParticipationFixture?: boolean;
  readonly absoluteAlignmentFixture?: boolean;
}

interface WasmYogaMigrationExampleProps {
  /** Optional recorded cases. Omit for the concise public lesson. */
  readonly fixtures?: readonly YogaMigrationFixture[];
}

function requireFixtureValue<T>(value: T | undefined, label: string): T {
  if (value === undefined)
    throw new Error(`Fixture is missing ${label}.`);
  return value;
}

function requireFixtureNumber(value: unknown, label: string): number {
  if (typeof value !== "number")
    throw new Error(`Fixture ${label} must be numeric.`);
  return value;
}

/** Small, copyable public subset; the private lab supplies the complete recording. */
const DEFAULT_WASM_YOGA_MIGRATION_FIXTURES = [
  {"name":"grow","width":300,"height":100,"gap":12,"flexDirection":"row","flexWrap":"nowrap","boxes":[{"x":0,"y":0,"width":144,"height":80},{"x":156,"y":0,"width":144,"height":80}]},
  {"name":"cap","width":300,"height":100,"gap":12,"flexDirection":"row","flexWrap":"nowrap","boxes":[{"x":0,"y":0,"width":80,"height":80},{"x":92,"y":0,"width":208,"height":80}]},
  {"name":"shrink","width":220,"height":100,"gap":12,"flexDirection":"row","flexWrap":"nowrap","boxes":[{"x":0,"y":0,"width":120,"height":80},{"x":132,"y":0,"width":88,"height":80}]},
  {"name":"custom-column-measure","width":120,"height":140,"gap":0,"flexDirection":"column","flexWrap":"nowrap","containerStyle":{"alignItems":"flex-start","alignContent":"flex-start"},"customColumnMeasureFixture":true,"boxes":[{"x":0,"y":0,"width":40,"height":40},{"x":0,"y":40,"width":20,"height":20}],"itemStyles":[{"width":40,"height":"auto","flexBasis":"auto","flexGrow":0,"flexShrink":0,"minWidth":0,"minHeight":0},{"width":20,"height":20,"flexGrow":0,"flexShrink":0,"minWidth":0,"minHeight":0}]},
  {"name":"custom-column-measure-resized","width":120,"height":140,"gap":0,"flexDirection":"column","flexWrap":"nowrap","containerStyle":{"alignItems":"flex-start","alignContent":"flex-start"},"customColumnMeasureFixture":true,"boxes":[{"x":0,"y":0,"width":60,"height":30},{"x":0,"y":30,"width":20,"height":20}],"itemStyles":[{"width":60,"height":"auto","flexBasis":"auto","flexGrow":0,"flexShrink":0,"minWidth":0,"minHeight":0},{"width":20,"height":20,"flexGrow":0,"flexShrink":0,"minWidth":0,"minHeight":0}]}
] satisfies readonly YogaMigrationFixture[];

function createWasmYogaMigrationExampleContent(canvas: HTMLCanvasElement, fixtureCases: readonly YogaMigrationFixture[]) {
  let node: PibblNode;
  const index = signal(0);
  const ink = signal("#19375b");
  const selected = signal("none");
  const actual = new Map<string, string>();
  let rootTransform = new DOMMatrix();
  let nextStamp = 1, hits = 0;
  const stamps = new Map<string, number>();
  const boxes = new Map<string, {x:number;y:number;width:number;height:number}>();
  function recordBox(name: string) {
    const box = useLayoutBox();
    const stamp = useConst(() => nextStamp++);
    const transform = rootTransform.inverse().multiply(useCanvasContext().getTransform());
    stamps.set(name, stamp);
    boxes.set(name, {x:+(transform.e-392).toFixed(3),y:+(transform.f-240).toFixed(3),width:+box.width.toFixed(3),height:+box.height.toFixed(3)});
    return box;
  }
  function NestedLeaf({name,style:_style}:{name:string;style:BoxStyle & FlexItemStyle}) {
    const box=recordBox(name);
    return <Rectangle style={{width:box.width,height:box.height,fill:name.endsWith('1')?'#426b61':'#a63758',cursor:'pointer'}} onClick={()=>{hits++;selected.set(name);}} />;
  }
  function NestedCard({name,column,style:_style}:{name:string;column:boolean;style:BoxStyle & FlexItemStyle}) {
    const box=recordBox(name);
    actual.set(name, `${box.width} × ${box.height}`);
    return <Flex style={{width:box.width,height:box.height,flexDirection:column?'column':'row',gap:'10%',alignItems:'stretch'}}>
      <NestedLeaf key="first" name={`${name}1`} style={{width:column?'100%':'40%',height:column?'40%':'100%',flexBasis:'40%',flexGrow:0,flexShrink:0,minWidth:0,minHeight:0}} />
      <NestedLeaf key="second" name={`${name}2`} style={{width:column?'100%':'40%',height:column?'40%':'100%',flexBasis:'40%',flexGrow:0,flexShrink:0,minWidth:0,minHeight:0}} />
    </Flex>;
  }
  function LogicalPaddingLeaf({style:_style}:{style:BoxStyle & FlexItemStyle}) {
    const box=recordBox("A1");
    actual.set("A1", `${box.width} × ${box.height}`);
    return <Rectangle style={{width:box.width,height:box.height,fill:"#426b61",cursor:"pointer"}} onClick={()=>{hits++;selected.set("A1");}} />;
  }
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
    const box = recordBox(name);
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
          onClick={() => {hits++;selected.set(name);}}
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
  type AutoQueueStyle = SystemStyle & { width?: number; height?: number; minWidth?: number; minHeight?: number; flexBasis?: number | "auto"; flexGrow?: number; flexShrink?: number; marginTop?: FlexMargin };
  let queueMeasureCalls = 0, measuredQueueJobs = 8;
  const queueJobs = signal(8);
  const AutoQueue = definePrimitive<{ name: string }, AutoQueueStyle, AutoQueueStyle, SystemStyle & { width: number; height: number }>(props => {
    const box = recordBox(props.name);
    actual.set(props.name, `${box.width} × ${box.height}`);
    const columns = Math.max(1, Math.floor(box.width / 20));
    const tiles: PibblNode[] = [];
    for (let job = 0; job < measuredQueueJobs; job++) tiles.push(<Rectangle key={job} pointerEvents="none" style={{ left: (job % columns) * 20 + 1, top: Math.floor(job / columns) * 10 + 1, width: 18, height: 8, fill: "#426b61" }} />);
    return <><Rectangle onClick={() => { hits++; selected.set(props.name); }} style={{ width: box.width, height: box.height, fill: "#d6e3db", cursor: "pointer" }} />{tiles}</>;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: "measured", minContent: { width: 20, height: 80 }, maxContent: { width: 160, height: 10 } }),
    measure: ({ constraints }) => {
      queueMeasureCalls++;
      const jobs = queueJobs.get();
      measuredQueueJobs = jobs;
      const columns = Math.max(1, Math.floor(constraints.maxWidth / 20));
      return { status: "measured", size: { width: constraints.maxWidth, height: Math.ceil(jobs / columns) * 10 } };
    },
  });
  const queueWidth = computed(() => { const fixture = fixtureCases[index.get()]; return fixture.customCrossAutoFixture ? requireFixtureNumber(requireFixtureValue(fixture.itemStyles, "itemStyles")[0].width, "custom cross-auto width") : 80; });
  const queueNode = <AutoQueue key={0} name="A" style={{ width: queueWidth, minWidth: 0, flexShrink: 0, marginTop: "auto" }} />;
  const columnQueueWidth = computed(() => { const fixture = fixtureCases[index.get()]; return fixture.customColumnMeasureFixture ? requireFixtureNumber(requireFixtureValue(fixture.itemStyles, "itemStyles")[0].width, "custom column width") : 40; });
  const columnQueueNode = <AutoQueue key={0} name="A" style={{ width: columnQueueWidth, minWidth: 0, minHeight: 0, flexBasis: "auto", flexGrow: 0, flexShrink: 0 }} />;
  function JobControls() {
    const fixture = fixtureCases[index.get()];
    if (!("customColumnMeasureFixture" in fixture)) return null;
    return <>
      <Rectangle style={{left:600,top:52,width:132,height:28,fill:"#426b61",cursor:"pointer"}} onClick={() => queueJobs.update(value => value === 8 ? 12 : 8)} />
      <Text pointerEvents="none" style={{left:612,top:59,font:"12px sans-serif",fill:"#ffffff"}}>More jobs</Text>
    </>;
  }
  function Workspace() {
    rootTransform=useCanvasContext().getTransform();
    const fixture = fixtureCases[index.get()];
    const itemStyles = fixture.itemStyles;
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
    const intrinsicFixture = fixture.intrinsicFixture === true;
    const directionMatrixFixture = fixture.directionMatrixFixture === true;
    const autoMarginFixture = fixture.autoMarginFixture === true;
    const roundingFixture = fixture.roundingFixture === true;
    const relativeStaticFixture = fixture.relativeStaticFixture === true;
    const decoratedRelativeStaticFixture = fixture.decoratedRelativeStaticFixture === true;
    const absoluteParticipationFixture = fixture.absoluteParticipationFixture === true;
    const absoluteAlignmentFixture = fixture.absoluteAlignmentFixture === true;
    const nestedCrossMinFixture = fixture.nestedCrossMinFixture === true || fixture.nestedDecoratedCrossMinFixture === true || fixture.nestedDecoratedCrossMaxFixture === true || fixture.nestedDecoratedColumnCrossMaxFixture === true || fixture.nestedDecoratedColumnCrossMinFixture === true;
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
        {intrinsicFixture && requireFixtureValue(fixture.intrinsicNestedBoxes, "intrinsicNestedBoxes").map((box, i) => <Rectangle key={`intrinsic-reference-${i}`} pointerEvents="none" style={{left:28+box.x,top:240+box.y,width:box.width,height:box.height,fill:i===1?"#6e3e79":"#426b61"}} />)}
        {fixture.contentBoxes && fixture.contentBoxes.map((box, i) => <Rectangle key={`content-${i}`} pointerEvents="none" style={{left:28+box.x,top:240+box.y,width:box.width,height:box.height,fill:"#426b61"}} />)}
        <Flex
          style={{
            left: 392,
            top: 240,
            width: fixture.width,
            height: fixture.height,
            flexDirection: fixture.flexDirection,
            flexWrap: fixture.flexWrap,
            gap: fixture.gap,
            alignContent: fixture.containerStyle?.alignContent ?? "flex-start",
            alignItems: fixture.containerStyle?.alignItems ?? "flex-start",
            boxSizing: fixture.containerStyle?.boxSizing,
            columnGap: fixture.containerStyle?.columnGap,
            layoutDirection: fixture.layoutDirection,
            justifyContent: fixture.containerStyle?.justifyContent,
            padding: fixture.containerStyle?.padding,
            paddingStart: fixture.containerStyle?.paddingStart,
            borderWidth: fixture.containerStyle?.borderWidth,
            borderStartWidth: fixture.containerStyle?.borderStartWidth,
            rowGap: fixture.containerStyle?.rowGap,
          }}
        >
          {intrinsicFixture ? <>
            <Flex style={{width:requireFixtureValue(fixture.innerStyle, "innerStyle").width,flexDirection:"row",flexWrap:requireFixtureValue(fixture.innerStyle, "innerStyle").flexWrap,gap:requireFixtureValue(fixture.innerStyle, "innerStyle").gap,alignItems:"flex-start",flexGrow:requireFixtureValue(fixture.innerStyle, "innerStyle").flexGrow,flexShrink:requireFixtureValue(fixture.innerStyle, "innerStyle").flexShrink,minWidth:requireFixtureValue(fixture.innerStyle, "innerStyle").minWidth,minHeight:requireFixtureValue(fixture.innerStyle, "innerStyle").minHeight}}>
              {requireFixtureValue(fixture.intrinsicLeafStyles, "intrinsicLeafStyles").map((style, itemIndex) => <Rectangle key={`intrinsic-leaf-${itemIndex}`} style={{width:requireFixtureValue(style.width, "intrinsic leaf width"),height:requireFixtureValue(style.height, "intrinsic leaf height"),flexGrow:style.flexGrow,flexShrink:style.flexShrink,minWidth:style.minWidth,minHeight:style.minHeight,fill:itemIndex===1?"#6e3e79":"#426b61"}} />)}
            </Flex>
            <Panel name="B" style={requireFixtureValue(fixture.footerStyle, "footerStyle")} />
          </> : fixture.contentBoxes ? <Flex style={{width:requireFixtureValue(fixture.itemStyles, "itemStyles")[0].width,height:requireFixtureValue(fixture.itemStyles, "itemStyles")[0].height,boxSizing:requireFixtureValue(fixture.itemStyles, "itemStyles")[0].boxSizing,minWidth:0,minHeight:0,flexShrink:0,padding:"padding" in requireFixtureValue(fixture.itemStyles, "itemStyles")[0]?requireFixtureValue(fixture.itemStyles, "itemStyles")[0].padding:undefined,borderWidth:"borderWidth" in requireFixtureValue(fixture.itemStyles, "itemStyles")[0]?requireFixtureValue(fixture.itemStyles, "itemStyles")[0].borderWidth:undefined,borderStartWidth:"borderStartWidth" in requireFixtureValue(fixture.itemStyles, "itemStyles")[0]?requireFixtureValue(fixture.itemStyles, "itemStyles")[0].borderStartWidth:undefined,borderEndWidth:"borderEndWidth" in requireFixtureValue(fixture.itemStyles, "itemStyles")[0]?requireFixtureValue(fixture.itemStyles, "itemStyles")[0].borderEndWidth:undefined,layoutDirection:"layoutDirection" in requireFixtureValue(fixture.itemStyles, "itemStyles")[0]?requireFixtureValue(fixture.itemStyles, "itemStyles")[0].layoutDirection:undefined,paddingStart:"paddingStart" in requireFixtureValue(fixture.itemStyles, "itemStyles")[0]?requireFixtureValue(fixture.itemStyles, "itemStyles")[0].paddingStart:undefined,paddingEnd:"paddingEnd" in requireFixtureValue(fixture.itemStyles, "itemStyles")[0]?requireFixtureValue(fixture.itemStyles, "itemStyles")[0].paddingEnd:undefined}}><LogicalPaddingLeaf style={{width:"100%",height:"100%",flexShrink:0,minWidth:0,minHeight:0}} /></Flex>
            : nestedCrossMinFixture ? <>
              <Flex
                key="A"
                style={{
                  width: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").width,
                  height: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").height,
                  maxHeight: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").maxHeight,
                  maxWidth: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").maxWidth,
                  flexBasis: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").flexBasis,
                  flexGrow: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").flexGrow,
                  flexShrink: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").flexShrink,
                  minWidth: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").minWidth,
                  minHeight: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").minHeight,
                  flexDirection: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").flexDirection,
                  alignItems: requireFixtureValue(fixture.nestedOwnerStyle, "nestedOwnerStyle").alignItems,
                }}
              >
                {requireFixtureValue(fixture.nestedItemStyles, "nestedItemStyles").map((style, itemIndex) => (
                  <NestedLeaf
                    key={`nested-cross-${itemIndex}`}
                    name={`A${itemIndex + 1}`}
                    style={{
                      width: style.width,
                      height: style.height,
                      flexGrow: style.flexGrow,
                      flexShrink: style.flexShrink,
                      minWidth: style.minWidth,
                      minHeight: style.minHeight,
                    }}
                  />
                ))}
              </Flex>
              <Panel key="B" name="B" style={requireFixtureValue(fixture.itemStyles, "itemStyles")[1]} />
              <Panel key="C" name="C" style={requireFixtureValue(fixture.itemStyles, "itemStyles")[2]} />
            </>
            : fixture.nestedBoxes ? requireFixtureValue(fixture.itemStyles, "itemStyles").map((style,itemIndex) => itemIndex<3
            ? <NestedCard key={itemIndex} name={String.fromCharCode(65+itemIndex)} column={column} style={style} />
            : <Panel key={itemIndex} name="D" column={column} wrapped={wrapped} style={style} />)
            : fixture.ownerCrossAutoFixture ? <>
              <Flex key={0} style={{width:requireFixtureValue(fixture.itemStyles, "itemStyles")[0].width,minWidth:0,flexShrink:0,flexDirection:"row",flexWrap:"wrap",gap:10,alignItems:"flex-start",marginTop:"auto"}}>
                {requireFixtureValue(fixture.ownerLeafStyles, "ownerLeafStyles").map((style,itemIndex)=><Rectangle key={itemIndex} onClick={()=>{hits++;selected.set("A");}} style={{width:requireFixtureValue(style.width, "owner leaf width"),height:requireFixtureValue(style.height, "owner leaf height"),minWidth:0,minHeight:0,flexShrink:0,fill:itemIndex===1?"#6e3e79":"#426b61",cursor:"pointer"}} />)}
              </Flex><Panel key={1} name="B" style={requireFixtureValue(fixture.itemStyles, "itemStyles")[1]} />
            </>
            : fixture.customColumnMeasureFixture ? <>{columnQueueNode}<Panel key={1} name="B" style={requireFixtureValue(fixture.itemStyles, "itemStyles")[1]} /></>
            : fixture.customCrossAutoFixture ? <>{queueNode}<Panel key={1} name="B" style={requireFixtureValue(fixture.itemStyles, "itemStyles")[1]} /></>
            : fixture.textCrossAutoFixture ? <>
              <Text key={0} onClick={() => { hits++; selected.set("A"); }} style={{ width: requireFixtureValue(fixture.itemStyles, "itemStyles")[0].width, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, wrap: true, font: "10px monospace", lineHeight: 10, marginTop: "auto", fill: "#19375b", cursor: "pointer" }}>{fixture.textValue}</Text>
              <Panel key={1} name="B" style={requireFixtureValue(fixture.itemStyles, "itemStyles")[1]} />
            </>
            : itemStyles ? itemStyles.map((style, index) => <Panel key={index} name={String.fromCharCode(65+index)} column={column} wrapped={wrapped} style={style} />) : rectangles ? <>
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
          pointerEvents="none"
          style={{
            left: 28,
            top: 492,
            width: 700,
            wrap: true,
            font: "12px monospace",
            fill: "#19375b",
          }}
        >{intrinsicFixture
          ? `finite row wrap · numeric direct leaves settle ${fixture.boxes[0].width} × ${fixture.boxes[0].height} before footer B at y ${fixture.boxes[1].y}`
          : nestedCrossMinFixture
          ? "nestedDecoratedColumnCrossMinFixture" in fixture
            ? "border-box column-reverse · declared 20px Flex minWidth60% follows the 100px → 160px content cross size · its 100% leaves grow 60px → 96px"
            : "nestedDecoratedColumnCrossMaxFixture" in fixture
            ? "border-box column-reverse · declared 60px Flex maxWidth25% follows the 100px → 160px content cross size · its 100% leaves grow 25px → 40px"
            : "nestedDecoratedCrossMaxFixture" in fixture
            ? "border-box row-reverse · declared 60px Flex maxHeight25% follows the 100px → 160px content cross size · its 100% leaves grow 25px → 40px"
            : "nestedDecoratedCrossMinFixture" in fixture
            ? "border-box row-reverse · built-in Flex minHeight60% follows the 100px → 160px content cross size · C moves y94 → y130"
            : "built-in Flex minHeight60% follows its finite outer cross size · fixed inner leaves stay 20px · C moves y72 → y108"
          : "ownerCrossAutoFixture" in fixture
          ? "3 direct jobs · built-in wrapped Flex height controls top auto margin · click jobs A and sibling B"
          : "customColumnMeasureFixture" in fixture
          ? "finite column · paired custom provider measures 8 jobs at its exact 40px → 60px width · More jobs is a Pibbl-only content mutation; the pinned Yoga reference remains 8 jobs"
          : "customCrossAutoFixture" in fixture
          ? "8 job tiles · 20px columns × 10px rows · pure measured height controls top auto margin · click A/B"
          : "textCrossAutoFixture" in fixture
          ? "direct wrapped Text · measured height controls top auto margin · stretch is suppressed · native callback is a sizing probe, not font parity"
          : roundingFixture
          ? "Yoga point scale 0 · fractional logical boxes stay unrounded; Canvas backing pixels round separately · click A/B"
          : absoluteAlignmentFixture
          ? `${fixture.layoutDirection} absolute B · no-inset axes align inside content; explicit axes use the inner border · A/C keep flow slots`
          : absoluteParticipationFixture
          ? `${fixture.layoutDirection} absolute B leaves Flex flow · numeric insets start at the inner border edge · A/C keep slots and authored paint order`
          : decoratedRelativeStaticFixture
          ? `${fixture.layoutDirection} border-box row · asymmetric padding and border define the content box before static or relative physical insets · click exposed A, overlap B, and B`
          : relativeStaticFixture
          ? `${fixture.layoutDirection} direct row · static keeps its allocated slot; relative applies physical insets after allocation · click exposed A, overlap B, and B`
          : "autoOpposingMarginFixture" in fixture
          ? "sizing and bounds settle before auto slots share remaining space · click A/B"
          : "autoShorthandMarginFixture" in fixture
          ? "uniform auto margin · physical/logical zero edges override only their own slots · click A/B"
          : "autoCrossDirectionFixture" in fixture
          ? "cross auto margins follow physical edges across direction changes · click A/B/C"
          : "autoCrossMarginFixture" in fixture
          ? "cross auto edges use each line’s own height · click A/B/C"
          : "autoWrappedMarginFixture" in fixture
          ? "three 40px items · each actual line divides its own free space · click A/B/C"
          : autoMarginFixture
          ? `two items, 40px along the main axis · ${(column?fixture.height:fixture.width)-80}px free space goes to auto edges · click A/B at their new positions`
          : directionMatrixFixture
          ? fixture.name.startsWith("direction-insets-")
            ? `${fixture.layoutDirection} ${fixture.flexWrap} · zero child margins isolate asymmetric parent insets · reflection uses the Pibbl content box`
            : fixture.name.startsWith("direction-margins-")
            ? `${fixture.layoutDirection} ${fixture.flexWrap} · zero parent insets isolate logical margins6/3 · Pibbl centers the margin box`
            : `${fixture.flexDirection} ${fixture.flexWrap} · ${fixture.layoutDirection} receiver · combined logical inset/margin bounds · native and Pibbl coordinates are classified separately`
          : "contentBoxes" in fixture
          ? `${fixture.layoutDirection} row · logical inline padding overrides physical edges · inner leaf records the final content origin`
          : "nestedBoxes" in fixture
          ? `${fixture.flexDirection} ${fixture.flexWrap} · inner children40% + gap10% use final allocated card · keyed D follows outer reflow`
          : fixture.name.startsWith("margin-percent-")
          ? `${fixture.flexDirection} ${fixture.flexWrap} · margins use content width · ${"comparisonLabel" in fixture ? "Pibbl keeps physical cross margins; Yoga differs" : "L10% R15% T5% B20%"} · outer ${fixture.width} × ${fixture.height}px`
          : fixture.name.startsWith("cross-percent-")
          ? `${fixture.flexDirection} wrap · stretched automatic cross · ${fixture.name.includes("-min") ? "minimum60%" : "maximum25%"} of owner cross · owner ${fixture.width} × ${fixture.height}px`
          : fixture.name.startsWith("padding-percent-")
          ? `${fixture.flexDirection} · padding L10% R15% T5% B10%, all of owner width · ${fixture.name.includes("content-box") ? "content-box" : "border-box basis"} · owner ${fixture.width} × ${fixture.height}px`
          : fixture.name.startsWith("gap-percent-")
          ? `${fixture.flexDirection} ${fixture.flexWrap} · column gap10% of content width / row gap20% of content height · outer ${fixture.width} × ${fixture.height}px`
          : fixture.name.startsWith("aspect-wrap-")
          ? `${fixture.flexDirection} ${fixture.flexWrap} · ratio ${fixture.flexDirection === "row" ? 2 : 0.5} W/H · parent ${fixture.width} × ${fixture.height} px · main gap12 / cross gap10 px`
          : `${"comparisonLabel" in fixture ? fixture.comparisonLabel : fixture.name} · parent ${fixture.width} × ${fixture.height} px · ${fixture.flexDirection} · gap ${fixture.gap} px`}</Text>
      </>
    );
  }
  node = (
    <>
      <Rectangle style={{ width: 760, height: 540, fill: "#f3f0e8" }} />
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
        {fixtureCases.length} recorded cases: {fixtureCases.filter(value => !("classification" in value)).length} matches; other cases label the preserved differences.
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
        onClick={() => {
          queueJobs.set(8);
          index.update((value) => (value + 1) % fixtureCases.length);
        }}
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
      {fixtureCases.length > DEFAULT_WASM_YOGA_MIGRATION_FIXTURES.length && <>
      <Rectangle style={{left:484,top:142,width:120,height:36,fill:"#426b61",cursor:"pointer"}} onClick={() => {
        queueJobs.set(8);
        index.update(value => {
        const bounds = fixtureCases.findIndex(fixture => fixture.name === "percent-cap-row");
        const aspect = fixtureCases.findIndex(fixture => fixture.name === "aspect-wrap-row");
        const gaps = fixtureCases.findIndex(fixture => fixture.name === "gap-percent-row-nowrap");
        const padding = fixtureCases.findIndex(fixture => fixture.name === "padding-percent-row-content-box");
        const nested = fixtureCases.findIndex(fixture => fixture.name === "nested-percent-gap-row-nowrap");
        const margins = fixtureCases.findIndex(fixture => fixture.name === "margin-percent-row-nowrap");
        const crossBounds = fixtureCases.findIndex(fixture => fixture.name === "cross-percent-row-min");
        const logicalPadding = fixtureCases.findIndex(fixture => fixture.name === "logical-padding-end-percent-ltr-logical-last");
        const logicalBorders = fixtureCases.findIndex(fixture => fixture.name === "logical-border-end-thirty-ltr-logical-last-content-box");
        const intrinsic = fixtureCases.findIndex(fixture => fixture.name === "intrinsic-row-wrap-column-wide");
        const directionMatrix = fixtureCases.findIndex(fixture => fixture.name === "direction-matrix-row-wrap-ltr");
        const autoMargins = fixtureCases.findIndex(fixture => fixture.name === "auto-margin-left");
        const wrappedAutoMargins = fixtureCases.findIndex(fixture => fixture.name === "auto-wrap-row-wrap-ltr");
        const crossAutoMargins = fixtureCases.findIndex(fixture => fixture.name === "auto-cross-row-top-ltr");
        const crossAutoDirections = fixtureCases.findIndex(fixture => fixture.name === "auto-cross-direction-row-wrap-reverse-before-ltr");
        const autoShorthand = fixtureCases.findIndex(fixture => fixture.name === "auto-shorthand-all-ltr");
        const autoOpposing = fixtureCases.findIndex(fixture => fixture.name === "auto-opposing-main-grow-consumes");
        const textCrossAuto = fixtureCases.findIndex(fixture => fixture.name === "text-cross-auto-top-stretch-wide");
        const customCrossAuto = fixtureCases.findIndex(fixture => fixture.name === "custom-cross-auto-top-stretch-wide");
        const ownerCrossAuto = fixtureCases.findIndex(fixture => fixture.name === "owner-cross-auto-top-stretch-wide");
        const rounding = fixtureCases.findIndex(fixture => "roundingFixture" in fixture);
        const nestedCrossMin = fixtureCases.findIndex(fixture => "nestedCrossMinFixture" in fixture);
        const nestedDecoratedCrossMin = fixtureCases.findIndex(fixture => "nestedDecoratedCrossMinFixture" in fixture);
        const nestedDecoratedCrossMax = fixtureCases.findIndex(fixture => "nestedDecoratedCrossMaxFixture" in fixture);
        const nestedDecoratedColumnCrossMax = fixtureCases.findIndex(fixture => "nestedDecoratedColumnCrossMaxFixture" in fixture);
        const nestedDecoratedColumnCrossMin = fixtureCases.findIndex(fixture => "nestedDecoratedColumnCrossMinFixture" in fixture);
        const customColumnMeasure = fixtureCases.findIndex(fixture => "customColumnMeasureFixture" in fixture);
        const relativeStatic = fixtureCases.findIndex(fixture => "relativeStaticFixture" in fixture);
        const decoratedRelativeStatic = fixtureCases.findIndex(fixture => "decoratedRelativeStaticFixture" in fixture);
        const absoluteParticipation = fixtureCases.findIndex(fixture => "absoluteParticipationFixture" in fixture);
        const absoluteAlignment = fixtureCases.findIndex(fixture => "absoluteAlignmentFixture" in fixture);
        return value < bounds ? bounds : value < aspect ? aspect : value < gaps ? gaps : value < padding ? padding : value < crossBounds ? crossBounds : value < margins ? margins : value < nested ? nested : value < logicalPadding ? logicalPadding : value < logicalBorders ? logicalBorders : value < intrinsic ? intrinsic : value < directionMatrix ? directionMatrix : value < autoMargins ? autoMargins : value < wrappedAutoMargins ? wrappedAutoMargins : value < crossAutoMargins ? crossAutoMargins : value < crossAutoDirections ? crossAutoDirections : value < autoShorthand ? autoShorthand : value < autoOpposing ? autoOpposing : value < textCrossAuto ? textCrossAuto : value < customCrossAuto ? customCrossAuto : value < ownerCrossAuto ? ownerCrossAuto : value < rounding ? rounding : value < nestedCrossMin ? nestedCrossMin : value < nestedDecoratedCrossMin ? nestedDecoratedCrossMin : value < nestedDecoratedCrossMax ? nestedDecoratedCrossMax : value < nestedDecoratedColumnCrossMax ? nestedDecoratedColumnCrossMax : value < nestedDecoratedColumnCrossMin ? nestedDecoratedColumnCrossMin : value < customColumnMeasure ? customColumnMeasure : value < relativeStatic ? relativeStatic : value < decoratedRelativeStatic ? decoratedRelativeStatic : value < absoluteParticipation ? absoluteParticipation : value < absoluteAlignment ? absoluteAlignment : 0;
        });
      }} />
      <Text pointerEvents="none" style={{left:496,top:150,font:"14px sans-serif",fill:"#ffffff"}}>Next section</Text>
      </>}
      <Rectangle style={{left:616,top:142,width:116,height:36,fill:"#19375b",cursor:"pointer"}} onClick={() => {
        queueJobs.set(8);
        const latest = fixtureCases[fixtureCases.length - 1];
        const latestName = latest.absoluteAlignmentFixture
          ? fixtureCases.find(fixture => fixture.absoluteAlignmentFixture)!.name
          : latest.absoluteParticipationFixture
          ? fixtureCases.find(fixture => fixture.absoluteParticipationFixture)!.name
          : latest.decoratedRelativeStaticFixture
          ? fixtureCases.find(fixture => fixture.decoratedRelativeStaticFixture)!.name
          : latest.relativeStaticFixture
            ? fixtureCases.find(fixture => fixture.relativeStaticFixture)!.name
            : latest.name.replace(/-resized$/, "");
        index.set(fixtureCases.findIndex(fixture => fixture.name === latestName));
      }} />
      <Text pointerEvents="none" style={{left:624,top:150,font:"14px sans-serif",fill:"#ffffff"}}>Latest proof</Text>
      <JobControls />
      <Workspace />
      <Text
        pointerEvents="none"
        style={{
          left: 28,
          top: 520,
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
    }\nYoga 3.2.1 · 042f5013152e · ${fixture.name} · fixture count: ${fixtureCases.length}${"comparisonLabel" in fixture ? " · "+fixture.comparisonLabel : ""} · actual A: ${fixture.customColumnMeasureFixture ? `paired column provider · B: ${actual.get("B")} px` : fixture.textCrossAutoFixture ? `direct wrapped Text · sibling B: ${actual.get("B")} px` : "intrinsicFixture" in fixture ? `direct wrapped leaves · footer B: ${actual.get("B")} px` : ("nestedCrossMinFixture" in fixture || "nestedDecoratedCrossMinFixture" in fixture || "nestedDecoratedCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMinFixture" in fixture) ? `nested leaves A1/A2 · B: ${actual.get("B")} px · C: ${actual.get("C")} px` : "contentBoxes" in fixture ? `content ${actual.get("A1")} px` : fixture.name.startsWith("rectangle-") ? "direct Canvas boxes" : `${actual.get("A")} px · B: ${actual.get("B")} px`} · selected: ${selected.get()}${fixture.customColumnMeasureFixture ? "\ncustom column state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits,measureCalls:queueMeasureCalls,jobs:measuredQueueJobs,comparison:"pinned Yoga reference uses 8 jobs; More jobs is a Pibbl-only content mutation"}) : "intrinsicFixture" in fixture ? "\nintrinsic state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : ("nestedCrossMinFixture" in fixture || "nestedDecoratedCrossMinFixture" in fixture || "nestedDecoratedCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMinFixture" in fixture) ? "\nnested cross min state: "+JSON.stringify({decorated:"nestedDecoratedCrossMinFixture" in fixture || "nestedDecoratedCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMinFixture" in fixture,maximum:"nestedDecoratedCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMaxFixture" in fixture,column:"nestedDecoratedColumnCrossMaxFixture" in fixture || "nestedDecoratedColumnCrossMinFixture" in fixture,minimum:"nestedDecoratedColumnCrossMinFixture" in fixture,boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "absoluteAlignmentFixture" in fixture ? "\nabsolute alignment state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "absoluteParticipationFixture" in fixture ? "\nabsolute participation state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "decoratedRelativeStaticFixture" in fixture ? "\ndecorated relative position state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "relativeStaticFixture" in fixture ? "\nrelative position state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "roundingFixture" in fixture ? "\nrounding state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "autoMarginFixture" in fixture ? "\nauto margin state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits,canvasTransform:{a:rootTransform.a,b:rootTransform.b,c:rootTransform.c,d:rootTransform.d,e:rootTransform.e,f:rootTransform.f}}) : "directionMatrixFixture" in fixture ? "\ndirection matrix state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "contentBoxes" in fixture ? "\ncontent state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : "nestedBoxes" in fixture ? "\nnested state: "+JSON.stringify({boxes:Object.fromEntries(boxes),stamps:Object.fromEntries(stamps),hits}) : ""}`;
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

export function WasmYogaMigrationExample({ fixtures = DEFAULT_WASM_YOGA_MIGRATION_FIXTURES }: WasmYogaMigrationExampleProps = {}) {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmYogaMigrationExampleContent(canvas, fixtures),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
