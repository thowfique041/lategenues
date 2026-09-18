import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { signToken } from '../src/auth.js';
import { Attendance, Batch, Complaint, Content, Course, Enrollment, Exam, ExamAttempt, Notebook, Notification, Payment, QA, Routine, Setting, User } from '../src/models.js';

const enabled = process.env.RUN_E2E === '1';
const suite = enabled ? test : test.skip;
const tag = `QA-${Date.now()}`;
const email = (role: string) => `${tag.toLowerCase()}-${role}@example.com`;
let admin: any, teacher: any, student: any, guardian: any;
let adminToken: string, teacherToken: string, studentToken: string, guardianToken: string;
let courseId: string, batchId: string, examId: string;
let uploadedFile: string | undefined;

before(async () => {
  if (!enabled) return;
  await mongoose.connect(config.mongoUri);
  const password = await bcrypt.hash('Quality@123', 12);
  [admin, teacher, student] = await User.create([
    { name: `${tag} Admin`, email: email('admin'), password, role: 'admin' },
    { name: `${tag} Teacher`, email: email('teacher'), password, role: 'teacher' },
    { name: `${tag} Student`, email: email('student'), password, role: 'student' },
  ]);
  guardian = await User.create({ name: `${tag} Guardian`, email: email('guardian'), password, role: 'guardian', guardianOf: student.id });
  adminToken = signToken(admin); teacherToken = signToken(teacher); studentToken = signToken(student); guardianToken = signToken(guardian);
});

after(async () => {
  if (!enabled) return;
  const users = await User.find({ email: { $regex: `^${tag.toLowerCase()}` } }).select('_id');
  const ids = users.map(x => x._id);
  const courses = await Course.find({ title: { $regex: `^${tag}` } }).select('_id');
  const courseIds = courses.map(x => x._id);
  await Promise.all([
    ExamAttempt.deleteMany({ student: { $in: ids } }), Attendance.deleteMany({ student: { $in: ids } }),
    Enrollment.deleteMany({ student: { $in: ids } }), Payment.deleteMany({ student: { $in: ids } }),
    QA.deleteMany({ student: { $in: ids } }), Complaint.deleteMany({ author: { $in: ids } }),
    Notification.deleteMany({ title: { $regex: `^${tag}` } }), Notebook.deleteMany({ title: { $regex: `^${tag}` } }),
    Routine.deleteMany({ course: { $in: courseIds } }), Content.deleteMany({ course: { $in: courseIds } }),
    Exam.deleteMany({ course: { $in: courseIds } }), Batch.deleteMany({ course: { $in: courseIds } }),
    Course.deleteMany({ _id: { $in: courseIds } }), Setting.deleteMany({ key: `${tag}-setting` }), User.deleteMany({ _id: { $in: ids } }),
  ]);
  if (uploadedFile) await rm(uploadedFile, { force: true });
  await mongoose.disconnect();
});

suite('all core features work with role permissions', async () => {
  const course = await request(app).post('/api/courses').set('Authorization', `Bearer ${adminToken}`).send({ title: `${tag} Course`, slug: tag.toLowerCase(), category: 'academic', price: 100 }).expect(201);
  courseId = course.body._id;
  const batch = await request(app).post('/api/batches').set('Authorization', `Bearer ${adminToken}`).send({ name: `${tag} Batch`, course: courseId, students: [student.id], teachers: [teacher.id] }).expect(201);
  batchId = batch.body._id;
  await request(app).post('/api/enrollments').set('Authorization', `Bearer ${adminToken}`).send({ student: student.id, course: courseId, batch: batchId, progress: 25 }).expect(201);
  await request(app).post('/api/routines').set('Authorization', `Bearer ${teacherToken}`).send({ course: courseId, batch: batchId, subject: 'Physics', day: 'Monday', startsAt: '20:00', endsAt: '21:00' }).expect(201);
  await request(app).post('/api/content').set('Authorization', `Bearer ${teacherToken}`).send({ type: 'recording', title: `${tag} Video`, course: courseId, url: 'https://youtu.be/dQw4w9WgXcQ' }).expect(201);
  await request(app).post('/api/notebooks').set('Authorization', `Bearer ${teacherToken}`).send({ title: `${tag} Notebook`, course: courseId, content: 'F = ma' }).expect(201);

  const exam = await request(app).post('/api/exams').set('Authorization', `Bearer ${teacherToken}`).send({ title: `${tag} Exam`, course: courseId, totalMarks: 1, passMarks: 1, questions: [{ prompt: '2 + 2?', options: ['3','4'], answer: 1, marks: 1 }] }).expect(201);
  examId = exam.body._id;
  const studentExams = await request(app).get('/api/exams').set('Authorization', `Bearer ${studentToken}`).expect(200);
  const visibleExam = studentExams.body.find((x: any) => x._id === examId);
  assert.equal(visibleExam.questions[0].answer, undefined, 'answer keys must be hidden from students');
  const start = await request(app).post(`/api/exams/${examId}/start`).set('Authorization', `Bearer ${studentToken}`).expect(200);
  const questionId = start.body.exam.questions[0]._id;
  const result = await request(app).post(`/api/exams/${examId}/submit`).set('Authorization', `Bearer ${studentToken}`).send({ answers: [{ question: questionId, value: 1 }] }).expect(200);
  assert.equal(result.body.percentage, 100);

  const qa = await request(app).post('/api/qa').set('Authorization', `Bearer ${studentToken}`).send({ course: courseId, question: `${tag} Why?` }).expect(201);
  const answered = await request(app).patch(`/api/qa/${qa.body._id}`).set('Authorization', `Bearer ${teacherToken}`).send({ answer: 'Because.', status: 'answered' }).expect(200);
  assert.equal(answered.body.answers.length, 1);

  const complaint = await request(app).post('/api/complaints').set('Authorization', `Bearer ${guardianToken}`).send({ subject: `${tag} Concern`, category: 'Class', message: 'Please review.' }).expect(201);
  await request(app).patch(`/api/complaints/${complaint.body._id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'resolved', reply: 'Resolved.' }).expect(200);
  await request(app).post('/api/attendance').set('Authorization', `Bearer ${teacherToken}`).send({ student: student.id, batch: batchId, status: 'present' }).expect(201);
  const guardianAttendance = await request(app).get('/api/attendance').set('Authorization', `Bearer ${guardianToken}`).expect(200);
  assert.ok(guardianAttendance.body.every((x: any) => x.student === String(student.id)));

  await request(app).post('/api/payments').set('Authorization', `Bearer ${adminToken}`).send({ student: student.id, course: courseId, amount: 100, status: 'paid' }).expect(201);
  const guardianPayments = await request(app).get('/api/payments').set('Authorization', `Bearer ${guardianToken}`).expect(200);
  assert.ok(guardianPayments.body.every((x: any) => x.student === String(student.id)));

  await request(app).post('/api/notifications').set('Authorization', `Bearer ${adminToken}`).send({ role: 'student', title: `${tag} Notice`, message: 'Test' }).expect(201);
  const notifications = await request(app).get('/api/notifications').set('Authorization', `Bearer ${studentToken}`).expect(200);
  assert.ok(notifications.body.some((x: any) => x.title === `${tag} Notice`));

  await request(app).put(`/api/settings/${tag}-setting`).set('Authorization', `Bearer ${adminToken}`).send({ value: 'working' }).expect(200);
  const settings = await request(app).get('/api/settings/public').expect(200);
  assert.equal(settings.body[`${tag}-setting`], 'working');
  const search = await request(app).get(`/api/search?q=${encodeURIComponent(tag)}`).set('Authorization', `Bearer ${studentToken}`).expect(200);
  assert.ok(search.body.length >= 3);

  const upload = await request(app).post('/api/uploads').set('Authorization', `Bearer ${teacherToken}`).attach('file', Buffer.from('%PDF-1.4\n%%EOF'), { filename: `${tag}.pdf`, contentType: 'application/pdf' }).expect(201);
  assert.match(upload.body.url, /^\/uploads\//);
  uploadedFile = path.resolve(upload.body.url.replace(/^\//, ''));

  await request(app).post('/api/courses').set('Authorization', `Bearer ${studentToken}`).send({ title: 'Forbidden', slug: `${tag}-forbidden` }).expect(403);
});
