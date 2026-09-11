import {
  crc,
  crcPlayback,
  crcSignal,
  crcState,
  crcTransition,
  FocusManagement,
  Group,
  marker,
  parallel,
  Rectangle,
  sequence,
  spring,
  Text,
  track,
  tween,
  type CRCController,
} from "@crc/core";

function AnimatedCard() {
  const x = crcSignal(110, { debugName: "learning animation x" });
  const opacity = crcSignal(0.2, {
    debugName: "learning animation opacity",
  });
  const pulseScale = crcSignal(1, {
    debugName: "learning animation pulse scale",
  });
  const [targetScale, setTargetScale] = crcState(1);
  const [message, setMessage] = crcState("CLICK OR PRESS ENTER");
  const presentedScale = crcTransition(targetScale, {
    type: "spring",
    stiffness: 240,
    damping: 22,
    initial: 1,
    debugName: "learning target scale",
  });

  const entrance = sequence(
    parallel(
      track(
        x,
        tween({
          from: 110,
          to: 178,
          duration: 360,
          debugName: "learning entrance x",
        }),
      ),
      track(
        opacity,
        tween({
          from: 0.2,
          to: 1,
          duration: 360,
          debugName: "learning entrance opacity",
        }),
      ),
    ),
    marker("arrived"),
    track(
      pulseScale,
      spring({
        from: 1,
        to: 1.08,
        stiffness: 300,
        damping: 18,
        debugName: "learning pulse scale",
      }),
    ),
  );
  const playback = crcPlayback(entrance, {
    debugName: "learning entrance playback",
    onEvent: (event) => {
      if (event.type === "marker" && event.marker === "arrived") {
        setMessage("ARRIVED · ONE COMMITTED FRAME");
      }
    },
  });

  const currentX = x.get();
  const currentOpacity = opacity.get();
  const currentScale = presentedScale.get() * pulseScale.get();

  return [
    <Rectangle style={{ width: 720, height: 420, fill: "#eef2ff" }} />,
    <Text
      style={{
        x: 360,
        y: 58,
        fill: "#17211d",
        font: "900 24px sans-serif",
        textAlign: "center",
      }}
    >
      SIGNALS + ANIMATION
    </Text>,
    <Text
      style={{
        x: 360,
        y: 84,
        fill: "#475569",
        font: "600 12px monospace",
        textAlign: "center",
      }}
    >
      DEFINITIONS → PROGRAM → OWNED PLAYBACK → CENTRAL COMMIT
    </Text>,
    <Group
      style={{
        translateX: currentX,
        translateY: 126,
        scaleX: currentScale,
        scaleY: currentScale,
      }}
    >
      <Rectangle
        style={{
          width: 364,
          height: 172,
          fill: "#2563eb",
          stroke: "#17211d",
          strokeWidth: 6,
          opacity: currentOpacity,
          cursor: "pointer",
        }}
        onClick={() => {
          setTargetScale((value) => (value === 1 ? 0.96 : 1));
          setMessage("PLAYING IMMUTABLE PROGRAM");
          playback.play({ conflict: "replace" });
        }}
      />
      <Text
        style={{
          x: 182,
          y: 68,
          fill: "#ffffff",
          font: "900 22px sans-serif",
          textAlign: "center",
        }}
      >
        EXPLICIT .get()
      </Text>
      <Text
        style={{
          x: 182,
          y: 108,
          fill: "#f7c948",
          font: "700 12px monospace",
          textAlign: "center",
        }}
      >
        {message}
      </Text>
      <Text
        style={{
          x: 182,
          y: 138,
          fill: "#dbeafe",
          font: "600 11px monospace",
          textAlign: "center",
        }}
      >
        STYLE RECEIVES NUMBERS, NOT SIGNAL OBJECTS
      </Text>
    </Group>,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    <FocusManagement>
      <AnimatedCard />
    </FocusManagement>,
  );
}
