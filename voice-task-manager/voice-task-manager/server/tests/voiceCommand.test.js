const db = require('./db');
const mongoose = require('mongoose');
const { createTask, listTasks } = require('../src/services/taskService');
const { executeIntent, applyPending } = require('../src/services/voiceCommand');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

const userId = () => new mongoose.Types.ObjectId();

describe('voice command execution', () => {
  test('adds a task from an intent', async () => {
    const u = userId();
    const res = await executeIntent(u, { action: 'add', title: 'Call mom', priority: 'high' });
    expect(res.type).toBe('created');
    expect(await listTasks(u)).toHaveLength(1);
  });

  test('completes the only matching task', async () => {
    const u = userId();
    await createTask(u, { title: 'Dentist appointment' });
    const res = await executeIntent(u, { action: 'complete', target: 'dentist' });
    expect(res.type).toBe('updated');
    expect(res.task.status).toBe('done');
  });

  test('asks which task when the target is ambiguous, then applies the choice', async () => {
    const u = userId();
    const a = await createTask(u, { title: 'Email Rahul' });
    await createTask(u, { title: 'Email Priya' });
    const intent = { action: 'delete', target: 'email' };
    const res = await executeIntent(u, intent);
    expect(res.type).toBe('clarify');
    expect(res.candidates).toHaveLength(2);
    expect(await listTasks(u)).toHaveLength(2); // nothing deleted yet

    const done = await applyPending(u, res.pending, a._id);
    expect(done.type).toBe('deleted');
    expect(await listTasks(u)).toHaveLength(1);
  });

  test('reports an error when nothing matches', async () => {
    const res = await executeIntent(userId(), { action: 'delete', target: 'unicorn' });
    expect(res.type).toBe('error');
  });

  test('reschedules a task', async () => {
    const u = userId();
    await createTask(u, { title: 'Gym' });
    const res = await executeIntent(u, { action: 'reschedule', target: 'gym', dueDate: '2026-11-14T12:30:00.000Z' });
    expect(res.type).toBe('updated');
    expect(res.task.dueDate.toISOString()).toBe('2026-11-14T12:30:00.000Z');
  });

  test('never touches another user\'s tasks', async () => {
    const owner = userId();
    await createTask(owner, { title: 'Secret plan' });
    const res = await executeIntent(userId(), { action: 'delete', target: 'secret' });
    expect(res.type).toBe('error');
    expect(await listTasks(owner)).toHaveLength(1);
  });
});
