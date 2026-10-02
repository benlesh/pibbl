import { Group, Text } from '@crc/core';
export const AGENT_TEXT_SOURCE_ID = 'agent-text-verification-example';
export function AgentTextScene({ repaired }: { repaired: boolean }) {
  return <Group>
    <Text style={{ left: 24, top: 48, font: '20px sans-serif', fill: '#111827' }}>{repaired ? 'Revenue: 42' : 'Revenue: 24'}</Text>
    <Text style={{ left: 24, top: 88, font: '16px sans-serif', fill: '#111827' }}>PRIVATE_CUSTOMER_493</Text>
  </Group>;
}
