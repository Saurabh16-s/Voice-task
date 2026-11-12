const { parseIntent } = require('../src/services/intentParser');
const { localToUtc } = require('../src/utils/time');

const fakeClient = (content) => ({
  chat: { completions: { create: async () => ({ choices: [{ message: { content } }] }) } },
});

describe('parseIntent', () => {
  test('parses a valid add command and converts local time to UTC', async () => {
    const client = fakeClient(JSON.stringify({ action: 'add', title: 'Meeting', dueDate: '2026-11-13T17:00' }));
    const intent = await parseIntent('add a meeting tomorrow at 5', { client, timezone: 'Asia/Kolkata' });
    expect(intent.action).toBe('add');
    expect(intent.title).toBe('Meeting');
    expect(intent.dueDate).toBe('2026-11-13T11:30:00.000Z'); // 17:00 IST
  });

  test('returns unknown for non-JSON model output', async () => {
    const intent = await parseIntent('hello', { client: fakeClient('not json') });
    expect(intent.action).toBe('unknown');
  });

  test('returns unknown when the JSON violates the schema', async () => {
    const intent = await parseIntent('hello', { client: fakeClient(JSON.stringify({ action: 'launch-rocket' })) });
    expect(intent.action).toBe('unknown');
  });

  test('keeps target and filter fields', async () => {
    const client = fakeClient(JSON.stringify({ action: 'complete', target: 'dentist' }));
    const intent = await parseIntent('mark dentist done', { client });
    expect(intent).toMatchObject({ action: 'complete', target: 'dentist' });
  });
});

describe('localToUtc', () => {
  test('handles different timezones', () => {
    expect(localToUtc('2026-11-13T09:00', 'UTC').toISOString()).toBe('2026-11-13T09:00:00.000Z');
    expect(localToUtc('2026-11-13T09:00', 'America/New_York').toISOString()).toBe('2026-11-13T14:00:00.000Z');
  });

  test('defaults date-only values to 09:00 and rejects garbage', () => {
    expect(localToUtc('2026-11-13', 'UTC').toISOString()).toBe('2026-11-13T09:00:00.000Z');
    expect(localToUtc('next friday', 'UTC')).toBeNull();
  });
});
