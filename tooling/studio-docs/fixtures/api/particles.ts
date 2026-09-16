export const Particles2D = "particles-2d";
export const defineParticleEffect2D = () => undefined;
export const particleRange = (_min: number, _max: number) => undefined;
export interface CRCParticleEffect2D {
  readonly dimension: 2;
}
export interface Particles2DProps {
  readonly effect: CRCParticleEffect2D;
}
