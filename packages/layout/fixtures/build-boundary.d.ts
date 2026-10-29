/** Version-coupled declarations for the isolated official layout friend entry. */
declare module '@pibbl/core/internal/layout' {
  export interface StandaloneLayoutKernelBox { readonly id: number; readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
  export interface StandaloneLayoutKernelNode { readonly id: number; readonly parent: number | undefined; readonly children: readonly number[]; readonly style: Readonly<Record<string, unknown>>; readonly measure: ((input: { readonly width: { readonly minimum: number; readonly maximum: number }; readonly height: { readonly minimum: number; readonly maximum: number } }) => { readonly width: number; readonly height: number }) | undefined; readonly measureIntrinsic: (() => { readonly minWidth: number; readonly maxWidth: number; readonly minHeight: number; readonly maxHeight: number }) | undefined; }
  export interface StandaloneLayoutKernelInput { readonly root: number; readonly width: number; readonly height: number; readonly direction: 'ltr' | 'rtl'; readonly nodes: readonly StandaloneLayoutKernelNode[]; }
  export interface StandaloneLayoutKernel { calculate(input: StandaloneLayoutKernelInput): readonly StandaloneLayoutKernelBox[]; dispose(): void; }
  export function prepareStandaloneLayoutKernel(): Promise<void>;
  export function createStandaloneLayoutKernel(): StandaloneLayoutKernel;
}
