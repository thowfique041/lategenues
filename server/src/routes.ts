import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { allow, optionalAuth, requireAuth, signToken } from './auth.js';
import { Batch, Chapter, Complaint, Content, Course, Enrollment, Exam, ExamAttempt, Notebook, Notification, Payment, QA, Routine, Setting, Subject, User } from './models.js';
import { lms, refreshCourseProgress } from './lms.js';
import { activeEnrollment, deliverCourseUpdate } from './notifications.js';

export const api = Router();
api.use(lms);
const validate = (schema) => (req, res, next) => { const result = schema.safeParse(req.body); if (!result.success) return res.status(400).json({ message: result.error.issues[0]?.message || 'Invalid request' }); req.body = result.data; next(); };
const loginSchema = z.object({ email: z.string().min(3), password: z.string().min(6) });
const registerSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), phone: z.string().optional(), classLevel: z.string().optional(), group: z.string().optional() });
const profileSchema = z.object({ name: z.string().min(2), phone: z.string().max(30).optional(), classLevel: z.string().max(80).optional(), group: z.string().max(80).optional(), bio: z.string().max(500).optional(), avatar: z.string().url().or(z.literal('')).optional() });
const courseSchema = z.object({ title: z.string().min(2), slug: z.string().min(2).regex(/^[a-z0-9-]+$/), summary: z.string().optional(), category: z.enum(['academic','admission']).optional(), classLevel: z.string().optional(), subjects: z.array(z.string()).optional(), group: z.string().optional(), duration: z.string().optional(), instructor: z.string().optional(), price: z.number().nonnegative().optional(), thumbnail: z.string().optional(), featured: z.boolean().optional(), published: z.boolean().optional() });
const userCreateSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(['admin','teacher','student','guardian']), phone: z.string().optional(), classLevel: z.string().optional(), studentId: z.string().optional(), group: z.string().optional(), guardianOf: z.string().optional() });
const studentId = (user) => user.role === 'guardian' ? user.guardianOf : user.id;
const enrolledCourseIds = async (user) => Enrollment.find({ student: studentId(user), ...activeEnrollment() }).distinct('course');
const requireCourseAccess = async (user, course) => user.role === 'admin' || (user.role === 'teacher' ? await canManageCourse(user, course) : Boolean(course && await Enrollment.exists({ student: studentId(user), course, ...activeEnrollment() })));
const requireBatchAccess = async (user, course, batch) => !await requireCourseAccess(user, course) ? false : user.role === 'teacher' ? (!batch || await canManageBatch(user, course, batch)) : !batch || !['student','guardian'].includes(user.role) || Boolean(await Enrollment.exists({ student: studentId(user), course, batch, ...activeEnrollment() }));
const studentBatchScope = async (user) => {
  const enrollments = await Enrollment.find({ student: studentId(user), ...activeEnrollment() }).select('course batch');
  const clauses = enrollments.flatMap(x => x.batch ? [{ course: x.course, batch: x.batch }, { course: x.course, batch: null }] : [{ course: x.course, batch: null }]);
  return clauses.length ? clauses : [{ course: null }];
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
  const existing = await Enrollment.findOne({ student: req.user.id, course: course.id, ...activeEnrollment() });
  if (existing) return res.json({ enrolled: true, message: 'You already have access to this course' });
  if (course.price === 0) {
    await Enrollment.findOneAndUpdate({ student: req.user.id, course: course.id }, { status: 'active', paymentStatus: 'free', $unset: { expiresAt: '' } }, { upsert: true, new: true });
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
  if (item.course && !(await requireBatchAccess(req.user, item.course?._id || item.course, item.batch))) return res.status(403).json({ message: 'Purchase this course to access its content' });
  res.json(item);
});
api.get('/content/:id/file', requireAuth, async (req, res) => {
  const item = await Content.findById(req.params.id);
  if (!item || !item.url?.startsWith('/uploads/') || (!item.published && ['student','guardian'].includes(req.user.role))) return res.status(404).json({ message: 'File not found' });
  if (item.course && !await requireBatchAccess(req.user, item.course, item.batch)) return res.status(403).json({ message: 'Course access required' });
  if (req.query.download === 'true' && !item.downloadable) return res.status(403).json({ message: 'Download is disabled for this file' });
  const filename = path.basename(item.url);
  res.setHeader('Content-Disposition', item.downloadable && req.query.download === 'true' ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`);
  res.sendFile(path.resolve('uploads', filename), error => { if (error && !res.headersSent) res.status(404).json({ message: 'File unavailable' }) });
});

api.post('/content', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  if ((!req.body.course && (req.user.role !== 'admin' || req.body.type !== 'notice')) || (req.body.course && (!await validCourseLinks(req.body) || !await canManageBatch(req.user, req.body.course, req.body.batch)))) return res.status(403).json({ message: 'Assign a valid course, subject and chapter you manage' });
  const item = await Content.create({ ...req.body, published: req.body.status === 'draft' ? false : req.body.published, teacher: req.user.id });
  if (item.course && item.published) await deliverCourseUpdate({ course: item.course, batch: item.batch, type: String(item.type).toUpperCase().replace('-', '_'), title: item.type === 'notice' ? 'New course notice' : `New ${item.type.replace('-', ' ')} added`, message: item.title, relatedContent: item.id, url: `/learn/${item.id}` });
  res.status(201).json(item);
});
api.patch('/content/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const item = await Content.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Content not found' });
  if (req.body.course !== undefined && String(req.body.course) !== String(item.course || '')) return res.status(400).json({ message: 'Course cannot be changed after creation' });
  const course = item.course;
  if (!item.course && req.user.role !== 'admin') return res.status(403).json({ message: 'Not permitted' });
  if (item.course && (!await canManageBatch(req.user, item.course, item.batch) || !await canManageBatch(req.user, course, req.body.batch || item.batch) || !await validCourseLinks({ ...item.toObject(), ...req.body, course }))) return res.status(403).json({ message: 'Course assignment invalid' });
  const update = { ...req.body, ...(req.body.status === 'draft' ? { published: false } : req.body.status === 'published' ? { published: true } : {}) };
  const updated = await Content.findByIdAndUpdate(item.id, update, { new: true, runValidators: true });
  if (updated?.course && updated.published && Object.keys(req.body).length > 0) await deliverCourseUpdate({ course: updated.course, batch: updated.batch, type: String(updated.type).toUpperCase().replace('-', '_'), title: `Updated ${updated.type.replace('-', ' ')}`, message: updated.title, relatedContent: updated.id, url: `/learn/${updated.id}` });
  res.json(updated);
});
api.delete('/content/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const item = await Content.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Content not found' });
  if ((!item.course && req.user.role !== 'admin') || (item.course && !await canManageBatch(req.user, item.course, item.batch))) return res.status(403).json({ message: 'Course assignment invalid' });
  await item.deleteOne(); res.status(204).end();
});

api.get('/exams', requireAuth, async (req, res) => {
  const projection = ['student', 'guardian'].includes(req.user.role) ? '-questions.answer' : '';
  const query: any = { published: true };
  if (['student', 'guardian'].includes(req.user.role)) { query.course = { $in: await enrolledCourseIds(req.user) }; query.$or = await studentBatchScope(req.user); }
  else if (req.user.role === 'teacher') { query.course = { $in: await managedCourseIds(req.user) }; query.$or = await teacherBatchScope(req.user); }
  res.json(await Exam.find(query).select(projection).populate('course', 'title'));
});
api.post('/exams', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  if (!await validCourseLinks(req.body) || !await canManageBatch(req.user, req.body.course, req.body.batch)) return res.status(403).json({ message: 'Course assignment invalid' });
  const exam = await Exam.create(req.body);
  if (exam.published) await deliverCourseUpdate({ course: exam.course, batch: exam.batch, type: 'EXAM', title: 'New course exam', message: exam.title, relatedContent: exam.id, url: `/exam/${exam.id}` });
  res.status(201).json(exam);
});
api.patch('/exams/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return res.status(404).json({ message: 'Exam not found' });
  if (req.body.course !== undefined && String(req.body.course) !== String(exam.course)) return res.status(400).json({ message: 'Course cannot be changed after creation' });
  const course = exam.course;
  if (!await canManageBatch(req.user, exam.course, exam.batch) || !await canManageBatch(req.user, course, req.body.batch || exam.batch) || !await validCourseLinks({ ...exam.toObject(), ...req.body, course })) return res.status(403).json({ message: 'Course assignment invalid' });
  const updated = await Exam.findByIdAndUpdate(exam.id, req.body, { new: true, runValidators: true });
  if (updated?.published && Object.keys(req.body).length > 0) await deliverCourseUpdate({ course: updated.course, batch: updated.batch, type: 'EXAM', title: 'Course exam updated', message: updated.title, relatedContent: updated.id, url: `/exam/${updated.id}` });
  res.json(updated);
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
  if (['student','guardian'].includes(req.user.role)) query.exam = { $in: await Exam.find({ course: { $in: await enrolledCourseIds(req.user) }, $or: await studentBatchScope(req.user) }).distinct('_id') };
  if (req.user.role === 'teacher') query.exam = { $in: await Exam.find({ course: { $in: await managedCourseIds(req.user) }, $or: await teacherBatchScope(req.user) }).distinct('_id') };
  res.json(await ExamAttempt.find({ ...query, status: { $ne: 'in-progress' } }).populate('exam', 'title subject totalMarks passMarks').populate('student', 'name studentId').sort({ submittedAt: -1 }));
});

api.get('/qa', requireAuth, async (req, res) => {
  const query: any = req.user.role === 'student' ? { student: req.user.id, course: { $in: await enrolledCourseIds(req.user) } } : req.user.role === 'guardian' ? { student: req.user.guardianOf, course: { $in: await enrolledCourseIds(req.user) } } : req.user.role === 'teacher' ? { course: { $in: await managedCourseIds(req.user) } } : {};
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

const announcementInput = z.object({ course: z.string(), batch: z.string().optional(), title: z.string().trim().min(3).max(150), message: z.string().trim().min(3).max(2000) });
api.post('/course-announcements', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  const parsed = announcementInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const { course, batch, title, message } = parsed.data;
  if (!mongoose.isValidObjectId(course) || (batch && !mongoose.isValidObjectId(batch))) return res.status(400).json({ message: 'Valid course and batch required' });
  if (!await canManageBatch(req.user, course, batch) || (batch && !await Batch.exists({ _id: batch, course }))) return res.status(403).json({ message: 'Course assignment invalid' });
  const notice = await Content.create({ type: 'notice', course, batch: batch || null, title, description: message, published: true, teacher: req.user.id });
  const delivered = await deliverCourseUpdate({ course, batch, type: 'ANNOUNCEMENT', title, message, relatedContent: notice.id, url: '/course/' + course + '?tab=updates' });
  res.status(201).json({ notice, delivered });
});
api.get('/notifications', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') return res.json(await Notification.find({}).populate('course', 'title').populate('user', 'name email').sort({ createdAt: -1 }).limit(200));
  if (req.user.role === 'teacher') {
    const leadCourses = await Course.find({ instructor: req.user.id }).distinct('_id');
    const assignedBatches = await Batch.find({ teachers: req.user.id, active: true }).distinct('_id');
    const enrollments = await Enrollment.find({ $or: [{ course: { $in: leadCourses } }, { batch: { $in: assignedBatches } }] }).select('student course batch');
    const allowed = enrollments.map(x => ({ user: x.student, course: x.course, $or: [{ batch: null }, ...(x.batch ? [{ batch: x.batch }] : [])] }));
    if (!allowed.length) return res.json([]);
    return res.json(await Notification.find({ $or: allowed }).populate('course', 'title').sort({ createdAt: -1 }).limit(200));
  }
  const enrollments = await Enrollment.find({ student: studentId(req.user), ...activeEnrollment() }).select('course batch');
  const allowed = enrollments.map(x => ({ course: x.course, $or: [{ batch: null }, ...(x.batch ? [{ batch: x.batch }] : [])] }));
  if (!allowed.length) return res.json([]);
  res.json(await Notification.find({ user: studentId(req.user), $or: allowed }).populate('course', 'title').sort({ createdAt: -1 }).limit(100));
});
api.patch('/notifications/:id/read', requireAuth, allow('student'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found' });
  const notice = await Notification.findOne({ _id: req.params.id, user: req.user.id });
  if (!notice || !await requireBatchAccess(req.user, notice.course, notice.batch)) return res.status(404).json({ message: 'Notification not found' });
  notice.read = true; notice.readAt = new Date(); await notice.save(); res.json(notice);
});
api.get('/courses/:id/notification-report', requireAuth, allow('admin', 'teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Course not found' });
  if (!await canManageCourse(req.user, req.params.id)) return res.status(403).json({ message: 'Course assignment invalid' });
  const lead = req.user.role === 'admin' || await Course.exists({ _id: req.params.id, instructor: req.user.id });
  const assigned = lead ? [] : await Batch.find({ course: req.params.id, teachers: req.user.id, active: true }).distinct('_id');
  const enrollments = await Enrollment.find({ course: req.params.id, ...(lead ? {} : { batch: { $in: assigned } }) }).select('student batch status expiresAt');
  const allowed = enrollments.map(x => ({ user: x.student, $or: [{ batch: null }, ...(x.batch ? [{ batch: x.batch }] : [])] }));
  const active = enrollments.filter(x => ['active','completed'].includes(x.status) && (!x.expiresAt || x.expiresAt > new Date())).length;
  const expired = enrollments.length - active;
  const notifications = allowed.length ? await Notification.find({ course: req.params.id, $or: allowed }).sort({ createdAt: -1 }).limit(200).select('user batch type title read createdAt').populate('user', 'name') : [];
  res.json({ active, expired, notifications });
});
const resources: Record<string, { model: any; write: string[] }> = {
  batches: { model: Batch, write: ['admin'] },
  enrollments: { model: Enrollment, write: ['admin'] },
  routines: { model: Routine, write: ['admin', 'teacher'] },
  notebooks: { model: Notebook, write: ['admin', 'teacher'] },
  payments: { model: Payment, write: ['admin'] },
};
Object.entries(resources).forEach(([name, resource]) => {
  api.get(`/${name}`, requireAuth, async (req, res) => {
    const query: any = {};
    const subjectStudent = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
    if (['payments', 'enrollments'].includes(name) && ['student', 'guardian'].includes(req.user.role)) query.student = subjectStudent;
    if (['routines', 'notebooks'].includes(name) && ['student', 'guardian'].includes(req.user.role)) { query.course = { $in: await enrolledCourseIds(req.user) }; query.$or = await studentBatchScope(req.user); if (name === 'notebooks') query.status = { $in: ['live', 'saved'] }; }
    if (['routines', 'notebooks'].includes(name) && req.user.role === 'teacher') { query.course = { $in: await managedCourseIds(req.user) }; query.$or = await teacherBatchScope(req.user); }
    let cursor = resource.model.find(query).sort({ createdAt: -1 });
    if (name === 'payments') cursor = cursor.populate('student', 'name email phone').populate('course', 'title price');
    res.json(await cursor);
  });
  api.post(`/${name}`, requireAuth, allow(...resource.write), async (req, res) => {
    if (name === 'notebooks' && (!await validCourseLinks(req.body) || !await canManageBatch(req.user, req.body.course, req.body.batch))) return res.status(403).json({ message: 'Course assignment invalid' });
    const created = await resource.model.create({ ...req.body, ...(name === 'notebooks' ? { teacher: req.user.id } : {}) });
    if (name === 'notebooks' && ['live', 'saved'].includes(created.status)) await deliverCourseUpdate({ course: created.course, batch: created.batch, type: 'NOTEBOOK', title: 'New live notebook', message: created.title, relatedContent: created.id, url: '/notebook/' + created.id });
    res.status(201).json(created);
  });
  api.patch(`/${name}/:id`, requireAuth, allow(...resource.write), async (req, res) => {
    if (name === 'notebooks') {
      const note = await Notebook.findById(req.params.id);
      if (!note) return res.status(404).json({ message: 'Notebook not found' });
      if (req.body.course !== undefined && String(req.body.course) !== String(note.course)) return res.status(400).json({ message: 'Course cannot be changed after creation' });
      if (!await canManageBatch(req.user, note.course, note.batch) || !await canManageBatch(req.user, req.body.course || note.course, req.body.batch || note.batch)) return res.status(403).json({ message: 'Course assignment invalid' });
    }
    const updated = await resource.model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (name === 'notebooks' && updated && ['live', 'saved'].includes(updated.status) && Object.keys(req.body).length > 0) await deliverCourseUpdate({ course: updated.course, batch: updated.batch, type: 'NOTEBOOK', title: 'Live notebook updated', message: updated.title, relatedContent: updated.id, url: '/notebook/' + updated.id });
    if (name === 'payments' && updated?.status === 'paid') {
      await Enrollment.findOneAndUpdate({ student: updated.student, course: updated.course }, { status: 'active', paymentStatus: 'paid', $unset: { expiresAt: '' } }, { upsert: true, new: true });
    }
    if (name === 'payments' && updated?.status === 'refunded' && !await Payment.exists({ student: updated.student, course: updated.course, status: 'paid', _id: { $ne: updated.id } })) {
      await Enrollment.updateOne({ student: updated.student, course: updated.course, paymentStatus: 'paid' }, { status: 'cancelled' });
    }
    res.json(updated);
  });
  api.delete(`/${name}/:id`, requireAuth, allow(...resource.write), async (req, res) => { const record = await resource.model.findById(req.params.id); if (!record) return res.status(404).json({ message: 'Resource not found' }); if (name === 'notebooks' && !await canManageBatch(req.user, record.course, record.batch)) return res.status(403).json({ message: 'Course assignment invalid' }); if (req.user.role === 'teacher' && name !== 'notebooks' && name !== 'routines') return res.status(403).json({ message: 'Not permitted' }); if (req.user.role === 'teacher' && name === 'routines' && !await canManageBatch(req.user, record.course, record.batch)) return res.status(403).json({ message: 'Course assignment invalid' }); await record.deleteOne(); res.status(204).end(); });
});

api.post('/enrollments/:id/progress', requireAuth, allow('student'), (_req, res) => res.status(410).json({ message: 'Course progress is calculated from completed lessons and exams' }));
api.get('/analytics/me', requireAuth, async (req, res) => {
  const student = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
  const [results, enrollments] = await Promise.all([ExamAttempt.find({ student, status: { $ne: 'in-progress' } }), Enrollment.find({ student, ...activeEnrollment() })]);
  const average = results.length ? Math.round(results.reduce((sum, item) => sum + item.percentage, 0) / results.length) : 0;
  const freshProgress = await Promise.all(enrollments.map(item => refreshCourseProgress(String(student), String(item.course))));
  res.json({ average, exams: results.length, courseProgress: freshProgress.length ? Math.round(freshProgress.reduce((sum, value) => sum + value, 0) / freshProgress.length) : 0 });
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
    Content.find({ $and: [courseScope, { $or: [{ title: rx }, { description: rx }, { subject: rx }, { chapter: rx }] }, restricted ? { published: true } : {}] }).limit(8),
    Notebook.find({ $and: [courseScope, { $or: [{ title: rx }, { content: rx }, { subject: rx }, { chapter: rx }] }, restricted ? { status: { $in: ['live','saved'] } } : {}] }).limit(8),
    Exam.find({ $and: [courseScope, { $or: [{ title: rx }, { subject: rx }] }, restricted ? { published: true } : {}] }).limit(8),
    QA.find({ ...(restricted ? { student: studentId(req.user), course: { $in: courseIds } } : req.user.role === 'teacher' ? { course: { $in: courseIds } } : {}), question: rx }).limit(8),
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
    const [results, enrollments, upcoming] = await Promise.all([
      ExamAttempt.find({ student, status: { $ne: 'in-progress' } }), Enrollment.find({ student, ...activeEnrollment() }),
      Content.find({ type: 'live-class', course: { $in: courseIds }, $or: await studentBatchScope(req.user), published: true, startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).limit(3).populate('teacher', 'name'),
    ]);
    const freshProgress = await Promise.all(enrollments.map(item => refreshCourseProgress(String(student), String(item.course))));
    response.student = { courseProgress: freshProgress.length ? Math.round(freshProgress.reduce((sum, value) => sum + value, 0) / freshProgress.length) : 0, examsCompleted: results.length, activeCourses: enrollments.length, upcoming };
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
