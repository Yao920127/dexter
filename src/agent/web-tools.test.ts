import { describe, expect, test } from 'bun:test';
import { Agent } from './agent.js';

const HOST_TOOLS = ['read_file', 'write_file', 'edit_file', 'browser', 'bash', 'cron', 'heartbeat', 'memory_update'];

describe('web channel tool set', () => {
  test('binds no tool that touches the host', async () => {
    const agent = await Agent.create({ channel: 'web', model: 'gpt-6-astra' });
    const names = Object.keys(Object.fromEntries((agent as unknown as { toolMap: Map<string, unknown> }).toolMap));
    for (const blocked of HOST_TOOLS) expect(names).not.toContain(blocked);
    expect(names).toContain('get_financials');
  });
});
