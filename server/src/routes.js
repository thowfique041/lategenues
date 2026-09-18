import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { allow, requireAuth, signToken } from './auth.js';
import { Attendance, Batch, Complaint, Content, Course, Enrollment, Exam, ExamAttempt, Notebook, Notification, Payment, QA, Routine, Setting, User } from './models.js';

export const api = Router();
const validate = (schema) => (req, res, next) => { const result = schema.safeParse(req.body); if (!result.success) return res.status(400).json({ message: result.error.issues[0]?.message || 'Invalid request' }); req.body = result.data; next(); };
const loginSchema = z.object({ email: z.string().min(3), password: z.string().min(6) });
const courseSchema = z.object({ title: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9-]+$/), summary: z.string().optional(), category: z.enum(['academic','admission']).optional(), classLevel: z.string().optional(), subjects: z.array(z.string()).optional(), group: z.string().optional(), duration: z.string().optional(), instructor: z.string().optional(), price: z.number().nonnegative().optional(), thumbnail: z.string().optional(), featured: z.boolean().optional(), published: z.boolean().optional() });
const userCreateSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(['admin','teacher','student','guardian']), phone: z.string().optional(), classLevel: z.string().optional(), studentId: z.string().optional(), group: z.string().optional(), guardianOf: z.string().optional() });
const upload = multer({
  storage: multer.diskStorage({ destination: 'uploads', filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif)|application\/pdf|video\/mp4|application\/(msword|vnd\.openxmlformats-officedocument\.|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml))/.test(file.mimetype)),
});

api.get('/health', (_req, res) => res.json({ ok: true, service: 'LateGenues API' }));
api.post('/uploads', requireAuth, allow('admin', 'teacher', 'student'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'A supported file is required' });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, type: req.file.mimetype, size: req.file.size });
});

api.post('/auth/login', validate(loginSchema), async (req, res) => {
  const identifier = String(req.body.email || '').trim();
  const user = await User.findOne({ $or: [{ email: identifier.toLowerCase() }, { phone: identifier }] }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
    return res.status(401).json({ message: 'Email or password is incorrect' });
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

api.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

api.post('/auth/forgot-password', async (req, res) => {
  const exists = await User.exists({ email: req.body.email?.toLowerCase() });
  res.json({ message: exists ? 'Reset request recorded. Contact the administrator for a temporary password.' : 'If the account exists, reset instructions will be provided.' });
});

api.get('/courses', async (req, res) => {
  const query = req.query.all === 'true' ? {} : { published: true };
  res.json(await Course.find(query).populate('instructor', 'name avatar').sort({ featured: -1, createdAt: -1 }));
});
api.post('/courses', requireAuth, allow('admin'), validate(courseSchema), async (req, res) => res.status(201).json(await Course.create(req.body)));
api.patch('/courses/:id', requireAuth, allow('admin'), async (req, res) => res.json(await Course.findByIdAndUpdate(req.params.id, req.body, { new: true })));
api.delete('/courses/:id', requireAuth, allow('admin'), async (req, res) => { await Course.findByIdAndDelete(req.params.id); res.status(204).end(); });

api.get('/content', async (req, res) => {
  const query = { published: true };
  if (req.query.type) query.type = req.query.type;
  if (req.query.course) query.course = req.query.course;
  res.json(await Content.find(query).populate('course', 'title').populate('teacher', 'name').sort({ startsAt: 1, createdAt: -1 }));
});
api.post('/content', requireAuth, allow('admin', 'teacher'), async (req, res) => res.status(201).json(await Content.create({ ...req.body, teacher: req.user.id })));
api.patch('/content/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => res.json(await Content.findByIdAndUpdate(req.params.id, req.body, { new: true })));
api.delete('/content/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => { await Content.findByIdAndDelete(req.params.id); res.status(204).end(); });

api.get('/exams', requireAuth, async (_req, res) => res.json(await Exam.find({ published: true }).populate('course', 'title')));
api.post('/exams', requireAuth, allow('admin', 'teacher'), async (req, res) => res.status(201).json(await Exam.create(req.body)));
api.patch('/exams/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => res.json(await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true })));

api.post('/exams/:id/start', requireAuth, allow('student'), async (req, res) => {
  let attempt = await ExamAttempt.findOne({ exam: req.params.id, student: req.user.id, status: 'in-progress' });
  if (!attempt) attempt = await ExamAttempt.create({ exam: req.params.id, student: req.user.id });
  const exam = await Exam.findById(req.params.id).select('-questions.answer');
  res.json({ attempt, exam });
});
api.post('/exams/:id/submit', requireAuth, allow('student'), async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });
  let score = 0, correct = 0, wrong = 0, unanswered = 0;
  const answers = req.body.answers || [];
  exam.questions.forEach((q) => {
    const given = answers.find((a) => String(a.question) === String(q._id));
    if (!given || given.value === '' || given.value == null) unanswered += 1;
    else if (String(given.value).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) { correct += 1; score += q.marks; }
    else { wrong += 1; score -= exam.negativeMarking || 0; }
  });
  score = Math.max(0, score);
  const percentage = exam.totalMarks ? Math.round((score / exam.totalMarks) * 10000) / 100 : 0;
  const attempt = await ExamAttempt.findOneAndUpdate(
    { exam: exam.id, student: req.user.id },
    { answers, score, correct, wrong, unanswered, percentage, status: 'submitted', submittedAt: new Date() },
    { new: true, upsert: true },
  );
  res.json(attempt);
});
api.get('/results', requireAuth, async (req, res) => {
  const query = req.user.role === 'student' ? { student: req.user.id } : {};
  res.json(await ExamAttempt.find({ ...query, status: { $ne: 'in-progress' } }).populate('exam', 'title subject totalMarks passMarks').populate('student', 'name studentId').sort({ submittedAt: -1 }));
});

api.get('/qa', requireAuth, async (req, res) => {
  const query = req.user.role === 'student' ? { student: req.user.id } : {};
  res.json(await QA.find(query).populate('student teacher', 'name').populate('course', 'title').sort({ createdAt: -1 }));
});
api.post('/qa', requireAuth, allow('student'), async (req, res) => res.status(201).json(await QA.create({ ...req.body, student: req.user.id })));
api.patch('/qa/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const update = { ...req.body, teacher: req.user.id };
  if (req.body.answer) update.$push = { answers: { author: req.user.id, body: req.body.answer } };
  delete update.answer;
  res.json(await QA.findByIdAndUpdate(req.params.id, update, { new: true }));
});

api.get('/complaints', requireAuth, async (req, res) => {
  const query = ['admin'].includes(req.user.role) ? {} : { author: req.user.id };
  res.json(await Complaint.find(query).populate('author', 'name role').sort({ createdAt: -1 }));
});
api.post('/complaints', requireAuth, allow('guardian', 'student'), async (req, res) => res.status(201).json(await Complaint.create({ ...req.body, author: req.user.id })));
api.patch('/complaints/:id', requireAuth, allow('admin'), async (req, res) => res.json(await Complaint.findByIdAndUpdate(req.params.id, req.body, { new: true })));

const resources = {
  batches: { model: Batch, write: ['admin'] },
  enrollments: { model: Enrollment, write: ['admin'] },
  routines: { model: Routine, write: ['admin', 'teacher'] },
  attendance: { model: Attendance, write: ['admin', 'teacher'] },
  notebooks: { model: Notebook, write: ['admin', 'teacher'] },
  notifications: { model: Notification, write: ['admin', 'teacher'] },
  payments: { model: Payment, write: ['admin'] },
};
Object.entries(resources).forEach(([name, resource]) => {
  api.get(`/${name}`, requireAuth, async (req, res) => {
    const query = {};
    if (name === 'attendance' && req.user.role === 'student') query.student = req.user.id;
    if (name === 'payments' && req.user.role === 'student') query.student = req.user.id;
    if (name === 'notifications') { query.$or = [{ user: req.user.id }, { role: req.user.role }, { user: null, role: null }]; }
    res.json(await resource.model.find(query).sort({ createdAt: -1 }));
  });
  api.post(`/${name}`, requireAuth, allow(...resource.write), async (req, res) => res.status(201).json(await resource.model.create({ ...req.body, ...(name === 'attendance' ? { markedBy: req.user.id } : {}), ...(name === 'notebooks' ? { teacher: req.user.id } : {}) })));
  api.patch(`/${name}/:id`, requireAuth, allow(...resource.write), async (req, res) => res.json(await resource.model.findByIdAndUpdate(req.params.id, req.body, { new: true })));
  api.delete(`/${name}/:id`, requireAuth, allow(...resource.write), async (req, res) => { await resource.model.findByIdAndDelete(req.params.id); res.status(204).end(); });
});

api.post('/enrollments/:id/progress', requireAuth, allow('student'), async (req, res) => res.json(await Enrollment.findOneAndUpdate({ _id: req.params.id, student: req.user.id }, { progress: req.body.progress, $addToSet: { completedContent: req.body.content } }, { new: true })));
api.get('/analytics/me', requireAuth, async (req, res) => {
  const student = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
  const [results, attendance, enrollments] = await Promise.all([ExamAttempt.find({ student, status: { $ne: 'in-progress' } }), Attendance.find({ student }), Enrollment.find({ student })]);
  const average = results.length ? Math.round(results.reduce((sum, item) => sum + item.percentage, 0) / results.length) : 0;
  const present = attendance.filter((item) => item.status === 'present').length;
  res.json({ average, exams: results.length, attendance: attendance.length ? Math.round((present / attendance.length) * 100) : 0, courseProgress: enrollments.length ? Math.round(enrollments.reduce((sum, item) => sum + item.progress, 0) / enrollments.length) : 0 });
});

api.get('/settings/public', async (_req, res) => res.json(Object.fromEntries((await Setting.find({})).map((s) => [s.key, s.value]))));
api.get('/settings', requireAuth, allow('admin'), async (_req, res) => res.json(await Setting.find({})));
api.put('/settings/:key', requireAuth, allow('admin'), async (req, res) => res.json(await Setting.findOneAndUpdate({ key: req.params.key }, { value: req.body.value }, { new: true, upsert: true })));

api.get('/search', requireAuth, async (req, res) => {
  const term = String(req.query.q || '').trim();
  if (!term) return res.json([]);
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [courses, content, notebooks, exams, qa] = await Promise.all([
    Course.find({ $or: [{ title: rx }, { summary: rx }] }).limit(8),
    Content.find({ $or: [{ title: rx }, { description: rx }, { subject: rx }, { chapter: rx }] }).limit(8),
    Notebook.find({ $or: [{ title: rx }, { content: rx }, { subject: rx }, { chapter: rx }] }).limit(8),
    Exam.find({ $or: [{ title: rx }, { subject: rx }] }).limit(8),
    QA.find({ question: rx }).limit(8),
  ]);
  res.json([...courses.map(x => ({ type: 'course', id: x.id, title: x.title })), ...content.map(x => ({ type: x.type, id: x.id, title: x.title })), ...notebooks.map(x => ({ type: 'notebook', id: x.id, title: x.title })), ...exams.map(x => ({ type: 'exam', id: x.id, title: x.title })), ...qa.map(x => ({ type: 'qa', id: x.id, title: x.question }))]);
});

api.get('/dashboard', requireAuth, async (req, res) => {
  const [students, teachers, guardians, courses, batches, classes, exams, pending] = await Promise.all([
    User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'teacher' }), User.countDocuments({ role: 'guardian' }),
    Course.countDocuments(), Batch.countDocuments({ active: true }), Content.countDocuments({ type: { $in: ['live-class', 'recording'] } }), Exam.countDocuments(),
    Complaint.countDocuments({ status: { $ne: 'resolved' } }),
  ]);
  const response = { students, teachers, guardians, courses, batches, classes, exams, pending, role: req.user.role };
  if (['student', 'guardian'].includes(req.user.role)) {
    const student = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
    const [results, attendanceRows, enrollments, upcoming] = await Promise.all([
      ExamAttempt.find({ student, status: { $ne: 'in-progress' } }), Attendance.find({ student }), Enrollment.find({ student }),
      Content.find({ type: 'live-class', startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).limit(3).populate('teacher', 'name'),
    ]);
    const present = attendanceRows.filter(x => x.status === 'present').length;
    response.student = { courseProgress: enrollments.length ? Math.round(enrollments.reduce((s,x)=>s+x.progress,0)/enrollments.length) : 0, examsCompleted: results.length, attendance: attendanceRows.length ? Math.round((present/attendanceRows.length)*100) : 0, upcoming };
  }
  res.json(response);
});

api.get('/users', requireAuth, allow('admin'), async (req, res) => res.json(await User.find(req.query.role ? { role: req.query.role } : {}).sort({ createdAt: -1 })));
api.post('/users', requireAuth, allow('admin'), validate(userCreateSchema), async (req, res) => res.status(201).json(await User.create({ ...req.body, password: await bcrypt.hash(req.body.password, 12) })));
api.patch('/users/:id', requireAuth, allow('admin'), async (req, res) => {
  const body = { ...req.body }; if (body.password) body.password = await bcrypt.hash(body.password, 12);
  res.json(await User.findByIdAndUpdate(req.params.id, body, { new: true }));
});
api.delete('/users/:id', requireAuth, allow('admin'), async (req, res) => { await User.findByIdAndDelete(req.params.id); res.status(204).end(); });
