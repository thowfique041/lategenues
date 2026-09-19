import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { allow, optionalAuth, requireAuth, signToken } from './auth.js';
import { Attendance, Batch, Chapter, Complaint, Content, Course, Enrollment, Exam, ExamAttempt, Notebook, Notification, Payment, QA, Routine, Setting, Subject, User } from './models.js';
import { lms, refreshCourseProgress } from './lms.js';

export const api = Router();
api.use(lms);
const validate = (schema) => (req, res, next) => { const result = schema.safeParse(req.body); if (!result.success) return res.status(400).json({ message: result.error.issues[0]?.message || 'Invalid request' }); req.body = result.data; next(); };
const loginSchema = z.object({ email: z.string().min(3), password: z.string().min(6) });
const registerSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), phone: z.string().optional(), classLevel: z.string().optional(), group: z.string().optional() });
const profileSchema = z.object({ name: z.string().min(2), phone: z.string().max(30).optional(), classLevel: z.string().max(80).optional(), group: z.string().max(80).optional(), bio: z.string().max(500).optional(), avatar: z.string().url().or(z.literal('')).optional() });
const courseSchema = z.object({ title: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9-]+$/), summary: z.string().optional(), category: z.enum(['academic','admission']).optional(), classLevel: z.string().optional(), subjects: z.array(z.string()).optional(), group: z.string().optional(), duration: z.string().optional(), instructor: z.string().optional(), price: z.number().nonnegative().optional(), thumbnail: z.string().optional(), featured: z.boolean().optional(), published: z.boolean().optional() });
const userCreateSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(['admin','teacher','student','guardian']), phone: z.string().optional(), classLevel: z.string().optional(), studentId: z.string().optional(), group: z.string().optional(), guardianOf: z.string().optional() });
const studentId = (user) => user.role === 'guardian' ? user.guardianOf : user.id;
const enrolledCourseIds = async (user) => Enrollment.find({ student: studentId(user), status: { $in: ['active', 'completed'] } }).distinct('course');
const requireCourseAccess = async (user, course) => user.role === 'admin' || (user.role === 'teacher' ? await canManageCourse(user, course) : Boolean(course && await Enrollment.exists({ student: studentId(user), course, status: { $in: ['active', 'completed'] } })));
const requireBatchAccess = async (user, course, batch) => !await requireCourseAccess(user, course) ? false : user.role === 'teacher' ? (!batch || await canManageBatch(user, course, batch)) : !batch || !['student','guardian'].includes(user.role) || Boolean(await Enrollment.exists({ student: studentId(user), course, batch, status: { $in: ['active','completed'] } }));
const studentBatchScope = async (user) => {
  const enrollments = await Enrollment.find({ student: studentId(user), status: { $in: ['active','completed'] } }).select('course batch');
  return enrollments.flatMap(x => x.batch ? [{ course: x.course, batch: x.batch }, { course: x.course, batch: null }] : [{ course: x.course, batch: null }]);
};
const managedCourseIds = async (user) => {
  const direct = await Course.find({ instructor: user.id }).distinct('_id');
  const batches = await Batch.find({ teachers: user.id, active: true }).distinct('course');
  return [...new Set([...direct, ...batches].map(String))];
};
const canManageCourse = async (user, course) => user.role === 'admin' || Boolean(course && (await Course.exists({ _id: course, instructor: user.id }) || await Batch.exists({ course, teachers: user.id, active: true })));
const canManageBatch = async (user, course, batch) => user.role === 'admin' || Boolean(course && (await Course.exists({ _id: course, instructor: user.id }) || (batch && await Batch.exists({ _id: batch, course, teachers: user.id, active: true }))));
const teacherBatchScope = async (user) => {
  const direct = await Course.find({ instructor: user.id }).distinct('_id');
  const assigned = await Batch.find({ teachers: user.id, active: true }).select('course _id');
  return [{ course: { $in: direct } }, ...assigned.flatMap(x => [{ course: x.course, batch: x._id }, { course: x.course, batch: null }])];
};
const validCourseLinks = async (body) => {
  if (!body.course) return false;
  if (body.batch && !await Batch.exists({ _id: body.batch, course: body.course })) return false;
  if (body.subjectId) {
    const subject = await Subject.findOne({ _id: body.subjectId, course: body.course });
    if (!subject || (subject.batch && String(subject.batch) !== String(body.batch))) return false;
  }
  if (body.chapterId) {
    if (!body.subjectId) return false;
    const chapter = await Chapter.findOne({ _id: body.chapterId, course: body.course, subject: body.subjectId });
    if (!chapter || (chapter.batch && String(chapter.batch) !== String(body.batch))) return false;
  }
  if (body.contentId && !await Content.exists({ _id: body.contentId, course: body.course })) return false;
  if (body.relatedNotebook && !await Notebook.exists({ _id: body.relatedNotebook, course: body.course })) return false;
  if (body.relatedExam && !await Exam.exists({ _id: body.relatedExam, course: body.course })) return false;
  if (body.relatedMaterials?.length && await Content.countDocuments({ _id: { $in: body.relatedMaterials }, course: body.course }) !== body.relatedMaterials.length) return false;
  return true;
};
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

api.post('/auth/register', validate(registerSchema), async (req, res) => {
  const email = req.body.email.toLowerCase();
  if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists' });
  const user = await User.create({ ...req.body, email, role: 'student', password: await bcrypt.hash(req.body.password, 12) });
  res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

api.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

api.patch('/auth/profile', requireAuth, validate(profileSchema), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ message: 'Account not found' });
  res.json({ user });
});

api.post('/auth/forgot-password', async (req, res) => {
  const exists = await User.exists({ email: req.body.email?.toLowerCase() });
  res.json({ message: exists ? 'Reset request recorded. Contact the administrator for a temporary password.' : 'If the account exists, reset instructions will be provided.' });
});

api.get('/courses', optionalAuth, async (req, res) => {
  const query: any = req.query.all === 'true' && req.user?.role === 'admin' ? {} : req.query.all === 'true' && req.user?.role === 'teacher' ? { _id: { $in: await managedCourseIds(req.user) } } : { published: true };
  const enrolled = req.user && ['student', 'guardian'].includes(req.user.role) ? (await enrolledCourseIds(req.user)).map(String) : [];
  const pending = req.user?.role === 'student' ? (await Payment.find({ student: req.user.id, status: 'pending' }).distinct('course')).map(String) : [];
  if (req.query.mine === 'true') query._id = { $in: enrolled };
  const courses = await Course.find(query).populate('instructor', 'name avatar').sort({ featured: -1, createdAt: -1 });
  res.json(courses.map((course) => ({ ...course.toObject(), enrolled: enrolled.includes(course.id), paymentStatus: pending.includes(course.id) ? 'pending' : undefined })));
});
api.post('/courses', requireAuth, allow('admin'), validate(courseSchema), async (req, res) => res.status(201).json(await Course.create(req.body)));
api.patch('/courses/:id', requireAuth, allow('admin'), async (req, res) => res.json(await Course.findByIdAndUpdate(req.params.id, req.body, { new: true })));
api.delete('/courses/:id', requireAuth, allow('admin'), async (req, res) => { await Course.findByIdAndDelete(req.params.id); res.status(204).end(); });
api.post('/courses/:id/order', requireAuth, allow('student'), async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course?.published) return res.status(404).json({ message: 'Course not found' });
  const existing = await Enrollment.findOne({ student: req.user.id, course: course.id, status: { $in: ['active', 'completed'] } });
  if (existing) return res.json({ enrolled: true, message: 'You already have access to this course' });
  if (course.price === 0) {
    await Enrollment.findOneAndUpdate({ student: req.user.id, course: course.id }, { status: 'active' }, { upsert: true, new: true });
    return res.status(201).json({ enrolled: true, message: 'Free course added to your dashboard' });
  }
  const payment = await Payment.findOneAndUpdate(
    { student: req.user.id, course: course.id, status: 'pending' },
    { amount: course.price, method: req.body.method || 'manual', transactionId: req.body.transactionId },
    { upsert: true, new: true },
  );
  res.status(201).json({ enrolled: false, payment, message: 'Order submitted. Access starts after payment confirmation.' });
});

api.get('/content', optionalAuth, async (req, res) => {
  const query: any = { published: true };
  if (req.query.type) query.type = req.query.type;
  if (req.query.course) query.course = req.query.course;
  if (!req.user) query.course = { $exists: false };
  else if (['student', 'guardian'].includes(req.user.role)) { query.course = { $in: await enrolledCourseIds(req.user) }; query.$or = await studentBatchScope(req.user); }
  else if (req.user.role === 'teacher') { query.course = { $in: await managedCourseIds(req.user) }; query.$or = await teacherBatchScope(req.user); }
  res.json(await Content.find(query).populate('course', 'title').populate('teacher', 'name').sort({ startsAt: 1, createdAt: -1 }));
});
api.get('/content/:id', requireAuth, async (req, res) => {
  const item = await Content.findById(req.params.id).populate('course', 'title').populate('teacher', 'name');
  if (!item || (!item.published && ['student','guardian'].includes(req.user.role))) return res.status(404).json({ message: 'Content not found' });
  if (item.type !== 'notice' && !(await requireBatchAccess(req.user, item.course?._id || item.course, item.batch))) return res.status(403).json({ message: 'Purchase this course to access its content' });
  res.json(item);
});
api.get('/content/:id/file', requireAuth, async (req, res) => {
  const item = await Content.findById(req.params.id);
  if (!item || !item.url?.startsWith('/uploads/') || (!item.published && ['student','guardian'].includes(req.user.role))) return res.status(404).json({ message: 'File not found' });
  if (item.type !== 'notice' && !await requireBatchAccess(req.user, item.course, item.batch)) return res.status(403).json({ message: 'Course access required' });
  if (req.query.download === 'true' && !item.downloadable) return res.status(403).json({ message: 'Download is disabled for this file' });
  const filename = path.basename(item.url);
  res.setHeader('Content-Disposition', item.downloadable && req.query.download === 'true' ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`);
  res.sendFile(path.resolve('uploads', filename), error => { if (error && !res.headersSent) res.status(404).json({ message: 'File unavailable' }) });
});

api.post('/content', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  if (req.body.type !== 'notice' && (!await validCourseLinks(req.body) || !await canManageBatch(req.user, req.body.course, req.body.batch))) return res.status(403).json({ message: 'Assign a valid course, subject and chapter you manage' });
  res.status(201).json(await Content.create({ ...req.body, teacher: req.user.id }));
});
api.patch('/content/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const item = await Content.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Content not found' });
  const course = req.body.course || item.course;
  if (item.type !== 'notice' && (!await canManageBatch(req.user, item.course, item.batch) || !await canManageBatch(req.user, course, req.body.batch || item.batch) || !await validCourseLinks({ ...item.toObject(), ...req.body, course }))) return res.status(403).json({ message: 'Course assignment invalid' });
  res.json(await Content.findByIdAndUpdate(item.id, req.body, { new: true, runValidators: true }));
});
api.delete('/content/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const item = await Content.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Content not found' });
  if (item.type !== 'notice' && !await canManageBatch(req.user, item.course, item.batch)) return res.status(403).json({ message: 'Course assignment invalid' });
  await item.deleteOne(); res.status(204).end();
});

api.get('/exams', requireAuth, async (req, res) => {
  const projection = req.user.role === 'student' ? '-questions.answer' : '';
  const query: any = { published: true };
  if (['student', 'guardian'].includes(req.user.role)) { query.course = { $in: await enrolledCourseIds(req.user) }; query.$or = await studentBatchScope(req.user); }
  else if (req.user.role === 'teacher') { query.course = { $in: await managedCourseIds(req.user) }; query.$or = await teacherBatchScope(req.user); }
  res.json(await Exam.find(query).select(projection).populate('course', 'title'));
});
api.post('/exams', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  if (!await validCourseLinks(req.body) || !await canManageBatch(req.user, req.body.course, req.body.batch)) return res.status(403).json({ message: 'Course assignment invalid' });
  res.status(201).json(await Exam.create(req.body));
});
api.patch('/exams/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });
  const course = req.body.course || exam.course;
  if (!await canManageBatch(req.user, exam.course, exam.batch) || !await canManageBatch(req.user, course, req.body.batch || exam.batch) || !await validCourseLinks({ ...exam.toObject(), ...req.body, course })) return res.status(403).json({ message: 'Course assignment invalid' });
  res.json(await Exam.findByIdAndUpdate(exam.id, req.body, { new: true, runValidators: true }));
});

api.post('/exams/:id/start', requireAuth, allow('student'), async (req, res) => {
  const securedExam = await Exam.findById(req.params.id).select('course batch');
  if (!securedExam) return res.status(404).json({ message: 'Exam not found' });
  if (!(await requireBatchAccess(req.user, securedExam.course, securedExam.batch))) return res.status(403).json({ message: 'Purchase this course to access its exams' });
  const exam = await Exam.findById(req.params.id).select('-questions.answer');
  const now = new Date();
  if (exam.startsAt && exam.startsAt > now) return res.status(403).json({ message: 'Exam has not started yet' });
  if (exam.endsAt && exam.endsAt < now) return res.status(403).json({ message: 'Exam has ended' });
  if (!exam.published) return res.status(403).json({ message: 'Exam is not available' });
  let attempt = await ExamAttempt.findOne({ exam: req.params.id, student: req.user.id, status: 'in-progress' });
  if (!attempt) attempt = await ExamAttempt.create({ exam: req.params.id, student: req.user.id, startedAt: now });
  res.json({ attempt, exam });
});
api.patch('/exams/:id/attempt', requireAuth, allow('student'), async (req, res) => {
  const exam = await Exam.findById(req.params.id).select('course batch questions duration');
  if (!exam || !await requireBatchAccess(req.user, exam.course, exam.batch)) return res.status(403).json({ message: 'Exam access denied' });
  const attempt = await ExamAttempt.findOne({ exam: exam.id, student: req.user.id, status: 'in-progress' });
  if (!attempt) return res.status(404).json({ message: 'Active attempt not found' });
  if (!Array.isArray(req.body.answers)) return res.status(400).json({ message: 'Answers must be a list' });
  const validQuestions = new Set(exam.questions.map(q => String(q._id)));
  attempt.answers = req.body.answers.filter(a => validQuestions.has(String(a.question))).map(a => ({ question: a.question, value: a.value, marked: Boolean(a.marked) }));
  await attempt.save();
  res.json({ answers: attempt.answers });
});

api.post('/exams/:id/submit', requireAuth, allow('student'), async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });
  if (!(await requireBatchAccess(req.user, exam.course, exam.batch))) return res.status(403).json({ message: 'Purchase this course to access its exams' });
  const activeAttempt = await ExamAttempt.findOne({ exam: exam.id, student: req.user.id, status: 'in-progress' });
  if (!activeAttempt) return res.status(409).json({ message: 'No active attempt. Start the exam first.' });
  let score = 0, correct = 0, wrong = 0, unanswered = 0;
  const answers = Array.isArray(req.body.answers) ? req.body.answers : activeAttempt.answers;
  exam.questions.forEach((q) => {
    const given = answers.find((a) => String(a.question) === String(q._id));
    if (!given || given.value === '' || given.value == null) unanswered += 1;
    else if (String(given.value).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) { correct += 1; score += q.marks; }
    else { wrong += 1; score -= exam.negativeMarking || 0; }
  });
  score = Math.max(0, score);
  const percentage = exam.totalMarks ? Math.round((score / exam.totalMarks) * 10000) / 100 : 0;
  const attempt = await ExamAttempt.findOneAndUpdate(
    { _id: activeAttempt.id, student: req.user.id, status: 'in-progress' },
    { answers, score, correct, wrong, unanswered, percentage, status: 'submitted', submittedAt: new Date() },
    { new: true },
  );
  if (!attempt) return res.status(409).json({ message: 'Exam was already submitted' });
  await refreshCourseProgress(req.user.id, String(exam.course));
  res.json(attempt);
});
api.get('/results', requireAuth, async (req, res) => {
  const query: any = req.user.role === 'student' ? { student: req.user.id } : req.user.role === 'guardian' ? { student: req.user.guardianOf } : {};
  if (req.user.role === 'teacher') query.exam = { $in: await Exam.find({ course: { $in: await managedCourseIds(req.user) }, $or: await teacherBatchScope(req.user) }).distinct('_id') };
  res.json(await ExamAttempt.find({ ...query, status: { $ne: 'in-progress' } }).populate('exam', 'title subject totalMarks passMarks').populate('student', 'name studentId').sort({ submittedAt: -1 }));
});

api.get('/qa', requireAuth, async (req, res) => {
  const query: any = req.user.role === 'student' ? { student: req.user.id } : req.user.role === 'guardian' ? { student: req.user.guardianOf } : req.user.role === 'teacher' ? { course: { $in: await managedCourseIds(req.user) } } : {};
  res.json(await QA.find(query).populate('student teacher', 'name').populate('course', 'title').sort({ createdAt: -1 }));
});
api.post('/qa', requireAuth, allow('student'), async (req, res) => {
  if (!req.body.course || !(await requireCourseAccess(req.user, req.body.course))) return res.status(403).json({ message: 'Purchase this course before asking course questions' });
  res.status(201).json(await QA.create({ ...req.body, student: req.user.id }));
});
api.patch('/qa/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const question = await QA.findById(req.params.id);
  if (!question) return res.status(404).json({ message: 'Question not found' });
  if (!await canManageCourse(req.user, question.course)) return res.status(403).json({ message: 'Not assigned to this course' });
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

const resources: Record<string, { model: any; write: string[] }> = {
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
    const query: any = {};
    const subjectStudent = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
    if (['attendance', 'payments', 'enrollments'].includes(name) && ['student', 'guardian'].includes(req.user.role)) query.student = subjectStudent;
    if (['routines', 'notebooks'].includes(name) && ['student', 'guardian'].includes(req.user.role)) { query.course = { $in: await enrolledCourseIds(req.user) }; query.$or = await studentBatchScope(req.user); if (name === 'notebooks') query.status = { $in: ['live', 'saved'] }; }
    if (['routines', 'notebooks'].includes(name) && req.user.role === 'teacher') { query.course = { $in: await managedCourseIds(req.user) }; query.$or = await teacherBatchScope(req.user); }
    if (name === 'notifications') { query.$or = [{ user: req.user.id }, { role: req.user.role }, { user: null, role: null }]; }
    let cursor = resource.model.find(query).sort({ createdAt: -1 });
    if (name === 'payments') cursor = cursor.populate('student', 'name email phone').populate('course', 'title price');
    res.json(await cursor);
  });
  api.post(`/${name}`, requireAuth, allow(...resource.write), async (req, res) => {
    if (name === 'notebooks' && (!await validCourseLinks(req.body) || !await canManageBatch(req.user, req.body.course, req.body.batch))) return res.status(403).json({ message: 'Course assignment invalid' });
    res.status(201).json(await resource.model.create({ ...req.body, ...(name === 'attendance' ? { markedBy: req.user.id } : {}), ...(name === 'notebooks' ? { teacher: req.user.id } : {}) }));
  });
  api.patch(`/${name}/:id`, requireAuth, allow(...resource.write), async (req, res) => {
    if (name === 'notebooks') {
      const note = await Notebook.findById(req.params.id);
      if (!note) return res.status(404).json({ message: 'Notebook not found' });
      if (!await canManageBatch(req.user, note.course, note.batch) || !await canManageBatch(req.user, req.body.course || note.course, req.body.batch || note.batch)) return res.status(403).json({ message: 'Course assignment invalid' });
    }
    const updated = await resource.model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (name === 'payments' && updated?.status === 'paid') {
      await Enrollment.findOneAndUpdate({ student: updated.student, course: updated.course }, { status: 'active' }, { upsert: true, new: true });
    }
    res.json(updated);
  });
  api.delete(`/${name}/:id`, requireAuth, allow(...resource.write), async (req, res) => { const record = await resource.model.findById(req.params.id); if (!record) return res.status(404).json({ message: 'Resource not found' }); if (name === 'notebooks' && !await canManageBatch(req.user, record.course, record.batch)) return res.status(403).json({ message: 'Course assignment invalid' }); if (req.user.role === 'teacher' && name !== 'notebooks' && name !== 'routines' && name !== 'attendance') return res.status(403).json({ message: 'Not permitted' }); if (req.user.role === 'teacher' && name === 'routines' && !await canManageBatch(req.user, record.course, record.batch)) return res.status(403).json({ message: 'Course assignment invalid' }); if (req.user.role === 'teacher' && name === 'attendance' && String(record.markedBy) !== String(req.user.id)) return res.status(403).json({ message: 'Not permitted' }); await record.deleteOne(); res.status(204).end(); });
});

api.post('/enrollments/:id/progress', requireAuth, allow('student'), (_req, res) => res.status(410).json({ message: 'Course progress is calculated from completed lessons and exams' }));
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
  const restricted = ['student', 'guardian'].includes(req.user.role);
  const courseIds = restricted ? await enrolledCourseIds(req.user) : req.user.role === 'teacher' ? await managedCourseIds(req.user) : [];
  const courseScope = restricted ? { course: { $in: courseIds }, $or: await studentBatchScope(req.user) } : req.user.role === 'teacher' ? { course: { $in: courseIds }, $or: await teacherBatchScope(req.user) } : {};
  const [courses, content, notebooks, exams, qa] = await Promise.all([
    Course.find({ $or: [{ title: rx }, { summary: rx }] }).limit(8),
    Content.find({ ...courseScope, $or: [{ title: rx }, { description: rx }, { subject: rx }, { chapter: rx }] }).limit(8),
    Notebook.find({ ...courseScope, $or: [{ title: rx }, { content: rx }, { subject: rx }, { chapter: rx }] }).limit(8),
    Exam.find({ ...courseScope, $or: [{ title: rx }, { subject: rx }] }).limit(8),
    QA.find({ ...(req.user.role === 'student' ? { student: req.user.id } : {}), question: rx }).limit(8),
  ]);
  res.json([...courses.map(x => ({ type: 'course', id: x.id, title: x.title })), ...content.map(x => ({ type: x.type, id: x.id, title: x.title })), ...notebooks.map(x => ({ type: 'notebook', id: x.id, title: x.title })), ...exams.map(x => ({ type: 'exam', id: x.id, title: x.title })), ...qa.map(x => ({ type: 'qa', id: x.id, title: x.question }))]);
});

api.get('/dashboard', requireAuth, async (req, res) => {
  const [students, teachers, guardians, courses, batches, classes, exams, pending] = await Promise.all([
    User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'teacher' }), User.countDocuments({ role: 'guardian' }),
    Course.countDocuments(), Batch.countDocuments({ active: true }), Content.countDocuments({ type: { $in: ['live-class', 'recording'] } }), Exam.countDocuments(),
    Complaint.countDocuments({ status: { $ne: 'resolved' } }),
  ]);
  const response: any = { students, teachers, guardians, courses, batches, classes, exams, pending, role: req.user.role };
  if (['student', 'guardian'].includes(req.user.role)) {
    const student = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
    const courseIds = await enrolledCourseIds(req.user);
    const [results, attendanceRows, enrollments, upcoming] = await Promise.all([
      ExamAttempt.find({ student, status: { $ne: 'in-progress' } }), Attendance.find({ student }), Enrollment.find({ student }),
      Content.find({ type: 'live-class', course: { $in: courseIds }, startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).limit(3).populate('teacher', 'name'),
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
