import { Group, crc, definePrimitive, signal, type SystemStyle } from '@crc/core';
import {
  Capsule2D,
  Chain2D,
  PhysicsShape2D,
  PhysicsWorld2D,
  Segment2D,
  boxShape2D,
  collider2D,
  kinematicBody2D,
  withPhysicsShape2D,
  type Capsule2DProps,
  type Capsule2DStyle,
  type Chain2DProps,
  type Chain2DStyle,
  type CRCPhysicsAttachment2D,
  type CRCPhysicsBodyAttachment2D,
  type CRCPhysicsColliderAttachment2D,
  type CRCPhysicsKinematicBody2DOptions,
  type CRCPhysicsKinematicTarget2D,
  type CRCPhysicsPrimitiveProps2D,
  type CRCPhysicsVector2,
  type PhysicsShape2DProps,
  type PhysicsShape2DStyle,
  type Segment2DProps,
  type Segment2DStyle,
} from '@crc/core/physics/2d';

const canvas = document.createElement('canvas');
canvas.width = 360;
canvas.height = 200;
document.body.append(canvas);

const capsuleStyle: Capsule2DStyle = {
  start: [20, 40], end: [95, 40], radius: 12, fill: '#0f766e',
};
const segmentStyle: Segment2DStyle = {
  start: [20, 85], end: [115, 85], stroke: '#be123c', strokeWidth: 4,
};
const chainStyle: Chain2DStyle = {
  points: [[20, 125], [80, 145], [135, 125]], radius: 3, stroke: '#1d4ed8', strokeWidth: 2,
};
const shapeStyle: PhysicsShape2DStyle = {
  shape: boxShape2D({ width: 34, height: 26, center: [185, 130] }), fill: '#f59e0b',
};
const decorative: CRCPhysicsPrimitiveProps2D = { pointerEvents: 'none' };
const capsuleProps: Capsule2DProps = decorative;
const segmentProps: Segment2DProps = decorative;
const chainProps: Chain2DProps = decorative;
const shapeProps: PhysicsShape2DProps = decorative;

interface DiamondStyle extends SystemStyle { readonly size: number }
const RawDiamond = definePrimitive<{}, DiamondStyle>((_props, style, context) => {
  const half = style.size / 2;
  context.beginPath();
  context.moveTo(0, -half);
  context.lineTo(half, 0);
  context.lineTo(0, half);
  context.lineTo(-half, 0);
  context.closePath();
  context.fillStyle = '#7c3aed';
  context.fill();
});
const Diamond = withPhysicsShape2D(RawDiamond, {
  resolveShape: (style: Readonly<DiamondStyle>) => boxShape2D({ width: style.size, height: style.size }),
});

const position = signal<CRCPhysicsVector2>([260, 70]);
const target: CRCPhysicsKinematicTarget2D = { position };
const kinematicOptions: CRCPhysicsKinematicBody2DOptions = { target, collider: false };
const bodyAttachment: CRCPhysicsBodyAttachment2D = kinematicBody2D(kinematicOptions);
const colliderAttachment: CRCPhysicsColliderAttachment2D = collider2D({ tag: 'moving-diamond' });
const attachment: CRCPhysicsAttachment2D = colliderAttachment;

function MovingDiamond() {
  const [x, y] = position.get();
  return <Group physics={bodyAttachment} style={{ translateX: x, translateY: y }}>
    <Diamond physics={attachment} style={{ size: 28 }} />
  </Group>;
}

const controller = crc(canvas,
  <PhysicsWorld2D gravity={[0, 0]}>
    <Capsule2D {...capsuleProps} style={capsuleStyle} />
    <Segment2D {...segmentProps} style={segmentStyle} />
    <Chain2D {...chainProps} style={chainStyle} />
    <PhysicsShape2D {...shapeProps} style={shapeStyle} />
    <MovingDiamond />
  </PhysicsWorld2D>,
);

const button = document.createElement('button');
button.textContent = 'Move diamond';
button.addEventListener('click', () => {
  position.set([position.get()[0] === 260 ? 300 : 260, 70]);
});
document.body.append(button);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
