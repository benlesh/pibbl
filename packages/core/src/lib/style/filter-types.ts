export interface CRCBlurFilter {
  type: 'blur';
  radius: number;
}

export interface CRCBrightnessFilter {
  type: 'brightness';
  amount: number;
}

export interface CRCContrastFilter {
  type: 'contrast';
  amount: number;
}

export interface CRCDropShadowFilter {
  type: 'dropShadow';
  offsetX: number;
  offsetY: number;
  blurRadius?: number;
  color: string;
}

export interface CRCGrayscaleFilter {
  type: 'grayscale';
  amount: number;
}

export interface CRCHueRotateFilter {
  type: 'hueRotate';
  degrees: number;
}

export interface CRCInvertFilter {
  type: 'invert';
  amount: number;
}

export interface CRCOpacityFilter {
  type: 'opacity';
  amount: number;
}

export interface CRCSaturateFilter {
  type: 'saturate';
  amount: number;
}

export interface CRCSepiaFilter {
  type: 'sepia';
  amount: number;
}

export type CRCFilter =
  | CRCBlurFilter
  | CRCBrightnessFilter
  | CRCContrastFilter
  | CRCDropShadowFilter
  | CRCGrayscaleFilter
  | CRCHueRotateFilter
  | CRCInvertFilter
  | CRCOpacityFilter
  | CRCSaturateFilter
  | CRCSepiaFilter;
