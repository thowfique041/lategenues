import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';

test('health endpoint reports a healthy API', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, 'LateGenues API');
});

test('protected dashboard rejects anonymous access', async () => {
  const response = await request(app).get('/api/dashboard').expect(401);
  assert.match(response.body.message, /authentication/i);
});

test('uploads require authentication', async () => {
  await request(app).post('/api/uploads').expect(401);
});

test('course room and progress require authentication', async () => {
  await request(app).get('/api/courses/507f1f77bcf86cd799439011/room').expect(401);
  await request(app).patch('/api/courses/507f1f77bcf86cd799439011/content/507f1f77bcf86cd799439012/progress').send({ completed: true }).expect(401);
});
