import test from 'node:test';
import assert from 'node:assert/strict';
import { Enrollment, Notification } from '../src/models.js';
import { activeEnrollment, deliverCourseUpdate } from '../src/notifications.js';

test('course update targets active matching enrollment only', async () => {
  const query = activeEnrollment();
  assert.deepEqual(query.status.$in, ['active', 'completed']);
  assert.ok(query.$or.some((x:any) => x.expiresAt?.$gt instanceof Date));
  const find = Enrollment.find;
  const insertMany = Notification.insertMany;
  let recipients:any[] = [];
  let sent:any[] = [];
  try {
    (Enrollment as any).find = (filter:any) => { assert.equal(filter.course, 'course-a'); assert.equal(filter.batch, 'batch-a'); assert.deepEqual(filter.status.$in, ['active', 'completed']); return { select: async () => recipients }; };
    (Notification as any).insertMany = async (items:any[]) => { sent = items; return items; };
    recipients = [{ student: 'student-a', batch: 'batch-a' }, { student: 'student-a', batch: 'batch-a' }];
    const count = await deliverCourseUpdate({ course: 'course-a', batch: 'batch-a', type: 'EXAM', title: 'New exam', url: '/exam/1' });
    assert.equal(count, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].user, 'student-a');
    assert.equal(sent[0].course, 'course-a');
    recipients = []; sent = [];
    assert.equal(await deliverCourseUpdate({ course: 'course-a', batch: 'batch-a', type: 'EXAM', title: 'New exam', url: '/exam/2' }), 0);
    assert.equal(sent.length, 0);
  } finally {
    (Enrollment as any).find = find;
    (Notification as any).insertMany = insertMany;
  }
});
