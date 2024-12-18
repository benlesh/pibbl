export interface CRCJSXOptions {
  pragma?: string;
  pragmaFrag?: string;
  importSource?: string;
  development?: boolean;
  runtime?: 'classic' | 'automatic';
}

export interface TransformResult {
  code: string;
  map: string | null;
} 
