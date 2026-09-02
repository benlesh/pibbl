import {
  crc,
  crcEventTarget,
  crcState,
  createElement,
  defineComp,
  FocusManagement,
  KeyboardNavigation,
  rect,
  text,
  type CRCController,
  type CRCKeyboardEvent,
} from '@crc/core';

function boxPath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

type BoundaryName = 'INNER' | 'OUTER';

interface NavigationTargetProps {
  readonly boundary: BoundaryName;
  readonly color: string;
  readonly height: number;
  readonly label: string;
  readonly onFocusTarget: (label: string, boundary: BoundaryName) => void;
  readonly onInput: (input: string) => void;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

const NavigationTarget = defineComp<NavigationTargetProps>(
  function NavigationTarget({
    boundary,
    color,
    height,
    label,
    onFocusTarget,
    onInput,
    width,
    x,
    y,
  }) {
    const snapshot = crcEventTarget(
      {
        onClick: () => onInput('pointer'),
        onFocus: () => onFocusTarget(label, boundary),
        onKeyDown: (event: CRCKeyboardEvent) => onInput(event.key),
      },
      {
        path: boxPath(x, y, width, height),
        fill: true,
        cursor: 'pointer',
        keyboardNavigationBounds: { x, y, width, height },
      },
    );

    return [
      rect({
        style: {
          x,
          y,
          width,
          height,
          fill: color,
          stroke: snapshot.isFocused ? '#111827' : '#475569',
          strokeWidth: snapshot.isFocused ? 5 : 2,
        },
      }),
      snapshot.isFocusVisible
        ? rect({
            style: {
              x: x - 5,
              y: y - 5,
              width: width + 10,
              height: height + 10,
              stroke: '#facc15',
              strokeWidth: 4,
            },
          })
        : undefined,
      text({
        style: {
          x: x + width / 2,
          y: y + height / 2 + 5,
          text: label,
          textAlign: 'center',
          fill: '#ffffff',
          font: boundary === 'INNER' ? '800 17px Arial' : '800 18px Arial',
        },
      }),
    ];
  },
);

interface BoundaryProps {
  readonly onFocusTarget: (label: string, boundary: BoundaryName) => void;
  readonly onInput: (input: string) => void;
}

const InnerGrid = defineComp<BoundaryProps>(function InnerGrid({
  onFocusTarget,
  onInput,
}) {
  return [
    NavigationTarget({
      boundary: 'INNER',
      color: '#7c3aed',
      height: 88,
      label: 'Inner 1',
      onFocusTarget,
      onInput,
      width: 128,
      x: 225,
      y: 184,
    }),
    NavigationTarget({
      boundary: 'INNER',
      color: '#6d28d9',
      height: 88,
      label: 'Inner 2',
      onFocusTarget,
      onInput,
      width: 128,
      x: 367,
      y: 184,
    }),
    NavigationTarget({
      boundary: 'INNER',
      color: '#6d28d9',
      height: 88,
      label: 'Inner 3',
      onFocusTarget,
      onInput,
      width: 128,
      x: 225,
      y: 286,
    }),
    NavigationTarget({
      boundary: 'INNER',
      color: '#7c3aed',
      height: 88,
      label: 'Inner 4',
      onFocusTarget,
      onInput,
      width: 128,
      x: 367,
      y: 286,
    }),
  ];
});

const OuterGrid = defineComp<BoundaryProps>(function OuterGrid({
  onFocusTarget,
  onInput,
}) {
  return [
    NavigationTarget({
      boundary: 'OUTER',
      color: '#0f766e',
      height: 178,
      label: 'Outer left',
      onFocusTarget,
      onInput,
      width: 156,
      x: 34,
      y: 142,
    }),
    rect({
      style: {
        x: 207,
        y: 82,
        width: 306,
        height: 316,
        fill: '#ede9fe',
        stroke: '#7c3aed',
        strokeWidth: 3,
      },
    }),
    NavigationTarget({
      boundary: 'OUTER',
      color: '#4338ca',
      height: 54,
      label: 'Inner grid entry',
      onFocusTarget,
      onInput,
      width: 270,
      x: 225,
      y: 102,
    }),
    text({
      style: {
        x: 360,
        y: 175,
        text: 'TAB ENTERS · ARROWS STAY INSIDE',
        textAlign: 'center',
        fill: '#5b21b6',
        font: '800 10px monospace',
      },
    }),
    createElement(KeyboardNavigation, {
      mode: 'directional',
      children: InnerGrid({ onFocusTarget, onInput }),
    }),
    NavigationTarget({
      boundary: 'OUTER',
      color: '#0f766e',
      height: 178,
      label: 'Outer right',
      onFocusTarget,
      onInput,
      width: 156,
      x: 530,
      y: 142,
    }),
  ];
});

interface LessonStatus {
  readonly boundary: BoundaryName | 'NONE';
  readonly focused: string;
  readonly input: string;
}

const NestedDirectionalNavigationLesson = defineComp(
  function NestedDirectionalNavigationLesson() {
    const [status, setStatus] = crcState<LessonStatus>({
      boundary: 'NONE',
      focused: 'NONE',
      input: 'Click or Tab',
    });
    const onFocusTarget = (focused: string, boundary: BoundaryName) =>
      setStatus((current) => ({ ...current, boundary, focused }));
    const onInput = (input: string) =>
      setStatus((current) => ({ ...current, input }));

    return [
      rect({ style: { width: 720, height: 520, fill: '#f8fafc' } }),
      text({
        style: {
          x: 360,
          y: 30,
          text: 'A DIRECTIONAL GRID INSIDE A DIRECTIONAL GRID',
          textAlign: 'center',
          fill: '#0f172a',
          font: '800 20px Arial',
        },
      }),
      text({
        style: {
          x: 360,
          y: 58,
          text: 'Arrow across the outer cards. Tab into the inner grid, then arrow to its edges.',
          textAlign: 'center',
          fill: '#334155',
          font: '13px Arial',
        },
      }),
      createElement(KeyboardNavigation, {
        mode: 'directional',
        children: OuterGrid({ onFocusTarget, onInput }),
      }),
      rect({
        style: {
          x: 34,
          y: 422,
          width: 652,
          height: 72,
          fill: '#0f172a',
          stroke: '#475569',
          strokeWidth: 2,
        },
      }),
      text({
        style: {
          x: 54,
          y: 451,
          text: `FOCUSED: ${status.focused.toUpperCase()}`,
          fill: '#f8fafc',
          font: '800 14px monospace',
        },
      }),
      text({
        style: {
          x: 54,
          y: 477,
          text: `ACTIVE BOUNDARY: ${status.boundary}`,
          fill: status.boundary === 'INNER' ? '#c4b5fd' : '#5eead4',
          font: '800 13px monospace',
        },
      }),
      text({
        style: {
          x: 666,
          y: 477,
          text: `LAST INPUT: ${status.input}`,
          textAlign: 'right',
          fill: '#facc15',
          font: '800 13px monospace',
        },
      }),
    ];
  },
);

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    createElement(FocusManagement, {
      children: NestedDirectionalNavigationLesson({}),
    }),
  );
}
