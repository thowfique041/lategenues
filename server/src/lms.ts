import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { Attendance, Batch, Chapter, Content, Course, Enrollment, Exam, ExamAttempt, LessonProgress, Notebook, QA, Subject } from './models.js';

export const lms = Router();
const id = (value: unknown) => typeof value === 'string' && mongoose.isValidObjectId(value);
const denied = (res) => res.status(403).json({ message: 'You do not have access to this course' });
const missing = (res) => res.status(404).json({ message: 'Course not found' });
async function scope(user, courseId: string) {
  const course = await Course.findById(courseId).populate('instructor', 'name avatar qualification subject bio');
  if (!course) return null;
  if (user.role === 'admin') return { course, enrollment: null, batchIds: null };
  if (user.role === 'teacher') {
    const lead = String(course.instructor?._id || course.instructor) === String(user.id);
    const batches = lead ? [] : await Batch.find({ course: courseId, teachers: user.id, active: true }).distinct('_id');
    return lead || batches.length ? { course, enrollment: null, batchIds: lead ? null : batches } : false;
  }
  const student = user.role === 'guardian' ? user.guardianOf : user.id;
  const enrollment = await Enrollment.findOne({ student, course: courseId, status: { $in: ['active', 'completed'] } });
  if (!enrollment) return false;
  return { course, enrollment, batchIds: enrollment.batch ? [enrollment.batch] : null };
}
const batchFilter = (access: any) => access.batchIds ? { $or: [{ batch: { $in: access.batchIds } }, { batch: null }] } : access.enrollment ? { batch: null } : {};
const editor = (role: string) => role === 'admin' || role === 'teacher';
const subjectInput = z.object({ name: z.string().trim().min(2).max(100), batchId: z.string().optional(), order: z.number().int().min(0).optional(), active: z.boolean().optional() });
const chapterInput = z.object({ subjectId: z.string(), title: z.string().trim().min(2).max(150), order: z.number().int().min(0).optional(), active: z.boolean().optional() });

export async function refreshCourseProgress(student: string, course: string) {
  const enrollment = await Enrollment.findOne({ student, course, status: { $in: ['active', 'completed'] } });
  if (!enrollment) return 0;
  const batch = enrollment.batch ? { $or: [{ batch: enrollment.batch }, { batch: null }] } : { batch: null };
  const [content, exams] = await Promise.all([
    Content.find({ course, type: { $in: ['live-class', 'recording', 'material', 'book'] }, published: true, ...batch }).select('_id'),
    Exam.find({ course, published: true, ...batch }).select('_id'),
  ]);
  const [doneContentRows, attended, doneExams] = await Promise.all([
    LessonProgress.find({ student, course, content: { $in: content.map(x => x.id) }, completed: true }).select('content'),
    Attendance.find({ student, content: { $in: content.map(x => x.id) }, status: 'present' }).select('content'),
    ExamAttempt.distinct('exam', { student, exam: { $in: exams.map(x => x.id) }, status: { $in: ['submitted', 'reviewed'] } }),
  ]);
  const doneContent = new Set([...doneContentRows, ...attended].map(x => String(x.content))).size;
  const total = content.length + exams.length;
  const percentage = total ? Math.round((doneContent + doneExams.length) / total * 100) : 0;
  await Enrollment.updateOne({ _id: enrollment.id }, { progress: percentage });
  return percentage;
}

lms.get('/courses/:courseId/room', requireAuth, async (req, res) => {
  if (!id(req.params.courseId)) return missing(res);
  const access: any = await scope(req.user, req.params.courseId);
  if (access === null) return missing(res);
  if (!access) return denied(res);
  const courseId = req.params.courseId;
  const visible = req.user.role === 'admin' || req.user.role === 'teacher' ? {} : { published: true };
  const [batches, subjects, chapters, content, notebooks, exams, qa] = await Promise.all([
    Batch.find({ course: courseId, ...(access.enrollment ? { _id: { $in: access.enrollment.batch ? [access.enrollment.batch] : [] } } : access.batchIds ? { _id: { $in: access.batchIds } } : {}) }).select('name startsAt endsAt active').sort({ createdAt: 1 }),
    Subject.find({ course: courseId, active: true, ...batchFilter(access) }).sort({ order: 1, name: 1 }),
    Chapter.find({ course: courseId, active: true, ...batchFilter(access) }).sort({ order: 1, title: 1 }),
    Content.find({ course: courseId, ...visible, ...batchFilter(access) }).populate('teacher', 'name').sort({ startsAt: 1, createdAt: -1 }),
    Notebook.find({ course: courseId, ...batchFilter(access), ...(access.enrollment ? { status: { $in: ['live','saved'] } } : {}) }).populate('teacher', 'name').sort({ updatedAt: -1 }),
    Exam.find({ course: courseId, ...visible, ...batchFilter(access) }).select('-questions.answer').sort({ startsAt: 1 }),
    QA.find({ course: courseId, ...(['student', 'guardian'].includes(req.user.role) ? { student: req.user.role === 'guardian' ? req.user.guardianOf : req.user.id } : {}) }).populate('student teacher', 'name').sort({ createdAt: -1 }),
  ]);
  const student = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
  const classEnrollments = access.enrollment ? [] : await Enrollment.find({ course: courseId, ...(access.batchIds ? { batch: { $in: access.batchIds } } : {}), status: { $in: ['active','completed'] } }).populate('student', 'name').select('student progress lastActivity').sort({ lastActivity: -1 });
  const [lessonProgress, attempts, attendance] = access.enrollment ? await Promise.all([
    LessonProgress.find({ student, course: courseId }),
    ExamAttempt.find({ student, exam: { $in: exams.map(x => x.id) }, status: { $in: ['submitted', 'reviewed'] } }).populate('exam', 'title subject subjectId chapterId totalMarks passMarks'),
    Attendance.find({ student, content: { $in: content.filter(x => x.type === 'live-class').map(x => x.id) } }),
  ]) : [[], await ExamAttempt.find({ exam: { $in: exams.map(x => x.id) }, status: { $in: ['submitted', 'reviewed'] } }).populate('exam', 'title subject subjectId chapterId totalMarks passMarks').populate('student', 'name').sort({ submittedAt: -1 }), []];
  const eligibleContent = content.filter(x => ['recording', 'material', 'book', 'live-class'].includes(x.type));
  const completed = new Set([...lessonProgress.filter(x => x.completed).map(x => String(x.content)), ...attendance.filter(x => x.status === 'present').map(x => String(x.content))]);
  const examDone = new Set(attempts.map(x => String(x.exam?._id || x.exam)));
  const done = eligibleContent.filter(x => completed.has(String(x.id))).length + examDone.size;
  const total = eligibleContent.length + exams.length;
  const overall = total ? Math.round(done / total * 100) : 0;
  if (access.enrollment && access.enrollment.progress !== overall) await Enrollment.updateOne({ _id: access.enrollment.id }, { progress: overall });
  const recent = [...lessonProgress].sort((a: any, b: any) => +new Date(b.lastActivity) - +new Date(a.lastActivity))[0];
  const continueContent = recent ? content.find(x => String(x.id) === String(recent.content)) : null;
  const chapterProgress = chapters.map(chapter => {
    const lessons = eligibleContent.filter(x => String(x.chapterId) === String(chapter.id));
    const chapterExams = exams.filter(x => String(x.chapterId) === String(chapter.id));
    const count = lessons.length + chapterExams.length;
    const complete = lessons.filter(x => completed.has(String(x.id))).length + chapterExams.filter(x => examDone.has(String(x.id))).length;
    return { chapterId: chapter.id, completed: complete, total: count, percentage: count ? Math.round(complete / count * 100) : 0 };
  });
  res.json({ course: access.course, enrollment: access.enrollment, classEnrollments, batches, subjects, chapters, content, notebooks, exams, qa, lessonProgress, attempts, attendance, progress: { overall, completed: done, total, chapterProgress, continueContent, positionSeconds: recent?.positionSeconds || 0 } });
});

lms.post('/courses/:courseId/subjects', requireAuth, async (req, res) => {
  if (!id(req.params.courseId)) return missing(res);
  const access = await scope(req.user, req.params.courseId);
  if (access === null) return missing(res);
  if (!access || !editor(req.user.role)) return denied(res);
  const parsed = subjectInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  if (req.user.role === 'teacher' && (access as any).batchIds && !((access as any).batchIds.map(String).includes(parsed.data.batchId))) return denied(res);
  if (parsed.data.batchId && !await Batch.exists({ _id: parsed.data.batchId, course: req.params.courseId })) return res.status(400).json({ message: 'Batch does not belong to this course' });
  const subject = await Subject.create({ name: parsed.data.name, order: parsed.data.order || 0, active: parsed.data.active ?? true, course: req.params.courseId, batch: parsed.data.batchId || null });
  res.status(201).json(subject);
});
lms.post('/courses/:courseId/chapters', requireAuth, async (req, res) => {
  if (!id(req.params.courseId)) return missing(res);
  const access = await scope(req.user, req.params.courseId);
  if (access === null) return missing(res);
  if (!access || !editor(req.user.role)) return denied(res);
  const parsed = chapterInput.safeParse(req.body);
  if (!parsed.success || !id(parsed.data?.subjectId)) return res.status(400).json({ message: 'Valid subject and chapter title required' });
  const subject = await Subject.findOne({ _id: parsed.data.subjectId, course: req.params.courseId });
  if (!subject) return res.status(400).json({ message: 'Subject does not belong to this course' });
  if (req.user.role === 'teacher' && (access as any).batchIds && !((access as any).batchIds.map(String).includes(String(subject.batch)))) return denied(res);
  const chapter = await Chapter.create({ course: req.params.courseId, batch: subject.batch || null, subject: subject.id, title: parsed.data.title, order: parsed.data.order || 0, active: parsed.data.active ?? true });
  res.status(201).json(chapter);
});

lms.patch('/courses/:courseId/content/:contentId/progress', requireAuth, async (req, res) => {
  if (req.user.role !== 'student') return denied(res);
  if (!id(req.params.courseId) || !id(req.params.contentId)) return missing(res);
  const access: any = await scope(req.user, req.params.courseId);
  if (!access) return denied(res);
  const content = await Content.findOne({ _id: req.params.contentId, course: req.params.courseId, published: true, ...batchFilter(access) });
  if (!content) return res.status(404).json({ message: 'Lesson not found in this course' });
  const parsed = z.object({ positionSeconds: z.number().finite().min(0).optional(), completed: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid progress' });
  const previous = await LessonProgress.findOne({ student: req.user.id, content: content.id });
  const progress = await LessonProgress.findOneAndUpdate({ student: req.user.id, content: content.id }, { $set: { course: content.course, positionSeconds: Math.min(parsed.data.positionSeconds ?? previous?.positionSeconds ?? 0, 86400), completed: Boolean(previous?.completed || parsed.data.completed), lastActivity: new Date() } }, { upsert: true, new: true });
  await Enrollment.updateOne({ _id: access.enrollment.id }, { lastContent: content.id, lastActivity: new Date() });
  await refreshCourseProgress(req.user.id, req.params.courseId);
  res.json(progress);
});

lms.get('/courses/:courseId/results', requireAuth, async (req, res) => {
  if (!id(req.params.courseId)) return missing(res);
  const access: any = await scope(req.user, req.params.courseId);
  if (!access) return denied(res);
  if (!access.enrollment) return res.status(403).json({ message: 'Student results require an enrolled student account' });
  const exams = await Exam.find({ course: req.params.courseId, ...batchFilter(access) }).select('_id');
  const student = req.user.role === 'guardian' ? req.user.guardianOf : req.user.id;
  res.json(await ExamAttempt.find({ student, exam: { $in: exams.map(x => x.id) }, status: { $in: ['submitted', 'reviewed'] } }).populate('exam', 'title subject subjectId chapterId totalMarks passMarks').sort({ submittedAt: -1 }));
});
