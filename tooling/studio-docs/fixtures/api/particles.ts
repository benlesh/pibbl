export const Particles2D = "particles-2d";
export const defineParticleEffect2D = () => undefined;
export const particleRange = (_min: number, _max: number) => undefined;
export interface PibblParticleEffect2D {
  readonly dimension: 2;
}
export interface Particles2DProps {
  readonly effect: PibblParticleEffect2D;
}
