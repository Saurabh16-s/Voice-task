const request = require('supertest');
const app = require('../src/app');
const db = require('./db');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

const user = { name: 'Saurabh', email: 'saurabh@example.com', password: 'password123' };

describe('auth', () => {
  test('registers a user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('rejects duplicate emails with 409', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(409);
  });

  test('rejects short passwords with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...user, password: 'short' });
    expect(res.status).toBe(400);
  });

  test('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('rejects a wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  test('protects /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
