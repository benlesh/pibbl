import { Group, Rectangle, Text, type Signal } from '@crc/core';
export const AGENT_SIGNAL_MUTATION_SOURCE_ID = 'agent-signal-mutation-example';
export function AgentSignalMutationScene({ amount, onRender }: {
  amount: Signal<{ amount: number }>;
  onRender: (amount: number) => void;
}) {
  const value = amount.get().amount;
  onRender(value);
  return <Group>
    <Text style={{ x: 24, y: 24, font: '20px sans-serif', fill: '#111827' }}>Amount: {value}</Text>
    <Rectangle style={{ x: 24, y: 64, width: value * 8, height: 40, fill: '#2563eb' }} />
  </Group>;
}
