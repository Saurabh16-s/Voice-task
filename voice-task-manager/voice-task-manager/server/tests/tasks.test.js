const request = require('supertest');
const app = require('../src/app');
const db = require('./db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

async function signup(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'T', email, password: 'password123' });
  return { Authorization: `Bearer ${res.body.token}` };
}

describe('tasks API', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  test('creates a task', async () => {
    const auth = await signup('a@example.com');
    const res = await request(app).post('/api/tasks').set(auth).send({ title: 'Buy milk', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({ title: 'Buy milk', priority: 'high', status: 'todo' });
  });

  test('validates input', async () => {
    const auth = await signup('a@example.com');
    const res = await request(app).post('/api/tasks').set(auth).send({ title: '' });
    expect(res.status).toBe(400);
  });

  test('only lists the current user\'s tasks', async () => {
    const a = await signup('a@example.com');
    const b = await signup('b@example.com');
    await request(app).post('/api/tasks').set(a).send({ title: 'A task' });
    await request(app).post('/api/tasks').set(b).send({ title: 'B task' });
    const res = await request(app).get('/api/tasks').set(a);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe('A task');
  });

  test('updates and deletes a task', async () => {
    const auth = await signup('a@example.com');
    const { body } = await request(app).post('/api/tasks').set(auth).send({ title: 'Write tests' });
    const id = body.task._id;
    const patched = await request(app).patch(`/api/tasks/${id}`).set(auth).send({ status: 'done' });
    expect(patched.body.task.status).toBe('done');
    const del = await request(app).delete(`/api/tasks/${id}`).set(auth);
    expect(del.status).toBe(204);
  });

  test('cannot touch another user\'s task', async () => {
    const a = await signup('a@example.com');
    const b = await signup('b@example.com');
    const { body } = await request(app).post('/api/tasks').set(a).send({ title: 'Private' });
    const res = await request(app).delete(`/api/tasks/${body.task._id}`).set(b);
    expect(res.status).toBe(404);
  });
});
