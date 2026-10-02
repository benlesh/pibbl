export const AGENT_LATE_FONT_SOURCE_ID = 'agent-late-font-example';
import { Text, useLayoutBox, type Signal } from '@crc/core';
/** Public-API text scene; the owning application decides when font readiness invalidates it. */
export function AgentLateFontScene({ revision, family, onEvaluation }: {
 revision: Signal<number>;
 family: string;
 onEvaluation: (value: { width: number; fontSize: number }) => void;
}) {
 revision.get();
 const { width } = useLayoutBox();
 const fontSize = width < 300 ? 16 : 24;
 onEvaluation({ width, fontSize });
 return <Text style={{left:10,top:10,font:`${fontSize}px "${family}", monospace`,fill:'#2563eb'}}>MMMM</Text>;
}
