import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { allow, requireAuth, signToken } from './auth.js';
import { Complaint, Content, Course, Exam, QA, User } from './models.js';

export const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, service: 'LateGenues API' }));

api.post('/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
    return res.status(401).json({ message: 'Email or password is incorrect' });
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

api.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

api.get('/courses', async (req, res) => {
  const query = req.query.all === 'true' ? {} : { published: true };
  res.json(await Course.find(query).populate('instructor', 'name avatar').sort({ featured: -1, createdAt: -1 }));
});
api.post('/courses', requireAuth, allow('admin'), async (req, res) => res.status(201).json(await Course.create(req.body)));
api.patch('/courses/:id', requireAuth, allow('admin'), async (req, res) => res.json(await Course.findByIdAndUpdate(req.params.id, req.body, { new: true })));

api.get('/content', async (req, res) => {
  const query = { published: true };
  if (req.query.type) query.type = req.query.type;
  if (req.query.course) query.course = req.query.course;
  res.json(await Content.find(query).populate('course', 'title').populate('teacher', 'name').sort({ startsAt: 1, createdAt: -1 }));
});
api.post('/content', requireAuth, allow('admin', 'teacher'), async (req, res) => res.status(201).json(await Content.create({ ...req.body, teacher: req.user.id })));

api.get('/exams', requireAuth, async (_req, res) => res.json(await Exam.find({ published: true }).populate('course', 'title')));
api.post('/exams', requireAuth, allow('admin', 'teacher'), async (req, res) => res.status(201).json(await Exam.create(req.body)));

api.get('/qa', requireAuth, async (req, res) => {
  const query = req.user.role === 'student' ? { student: req.user.id } : {};
  res.json(await QA.find(query).populate('student teacher', 'name').populate('course', 'title').sort({ createdAt: -1 }));
});
api.post('/qa', requireAuth, allow('student'), async (req, res) => res.status(201).json(await QA.create({ ...req.body, student: req.user.id })));
api.patch('/qa/:id', requireAuth, allow('admin', 'teacher'), async (req, res) => res.json(await QA.findByIdAndUpdate(req.params.id, { ...req.body, teacher: req.user.id }, { new: true })));

api.get('/complaints', requireAuth, async (req, res) => {
  const query = ['admin'].includes(req.user.role) ? {} : { author: req.user.id };
  res.json(await Complaint.find(query).populate('author', 'name role').sort({ createdAt: -1 }));
});
api.post('/complaints', requireAuth, allow('guardian', 'student'), async (req, res) => res.status(201).json(await Complaint.create({ ...req.body, author: req.user.id })));
api.patch('/complaints/:id', requireAuth, allow('admin'), async (req, res) => res.json(await Complaint.findByIdAndUpdate(req.params.id, req.body, { new: true })));

api.get('/dashboard', requireAuth, async (req, res) => {
  const [students, teachers, courses, classes, exams, pending] = await Promise.all([
    User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'teacher' }), Course.countDocuments(),
    Content.countDocuments({ type: { $in: ['live-class', 'recording'] } }), Exam.countDocuments(),
    Complaint.countDocuments({ status: { $ne: 'resolved' } }),
  ]);
  res.json({ students, teachers, courses, classes, exams, pending });
});

api.get('/users', requireAuth, allow('admin'), async (req, res) => res.json(await User.find(req.query.role ? { role: req.query.role } : {}).sort({ createdAt: -1 })));
api.post('/users', requireAuth, allow('admin'), async (req, res) => res.status(201).json(await User.create({ ...req.body, password: await bcrypt.hash(req.body.password, 12) })));
