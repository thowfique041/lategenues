import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const options = { timestamps: true };

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'teacher', 'student', 'guardian'], default: 'student' },
  phone: String,
  avatar: String,
  classLevel: String,
  studentId: String,
  group: String,
  batch: String,
  qualification: String,
  subject: String,
  experience: String,
  bio: String,
  admissionDate: Date,
  guardianOf: { type: Schema.Types.ObjectId, ref: 'User' },
  active: { type: Boolean, default: true },
}, options);

const courseSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  summary: String,
  category: { type: String, enum: ['academic', 'admission'], default: 'academic' },
  classLevel: String,
  subjects: [String],
  group: String,
  duration: String,
  instructor: { type: Schema.Types.ObjectId, ref: 'User' },
  price: { type: Number, default: 0 },
  thumbnail: String,
  featured: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
}, options);

const batchSchema = new Schema({
  name: { type: String, required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  teachers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  startsAt: Date,
  endsAt: Date,
  active: { type: Boolean, default: true },
}, options);

const enrollmentSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: Schema.Types.ObjectId, ref: 'Batch' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  completedContent: [{ type: Schema.Types.ObjectId, ref: 'Content' }],
  status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active' },
}, options);

const contentSchema = new Schema({
  type: { type: String, enum: ['live-class', 'recording', 'material', 'book', 'notice'], required: true },
  title: { type: String, required: true },
  description: String,
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  batch: { type: Schema.Types.ObjectId, ref: 'Batch' },
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  chapter: String,
  url: String,
  fileType: String,
  startsAt: Date,
  endsAt: Date,
  duration: Number,
  downloadable: { type: Boolean, default: true },
  status: { type: String, enum: ['draft', 'upcoming', 'live', 'completed', 'published'], default: 'published' },
  published: { type: Boolean, default: true },
}, options);

const examSchema = new Schema({
  title: { type: String, required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  batch: { type: Schema.Types.ObjectId, ref: 'Batch' },
  subject: String,
  duration: { type: Number, default: 30 },
  totalMarks: { type: Number, default: 100 },
  passMarks: { type: Number, default: 40 },
  negativeMarking: { type: Number, default: 0 },
  startsAt: Date,
  endsAt: Date,
  questions: [{ type: { type: String, enum: ['mcq', 'true-false', 'short', 'written'], default: 'mcq' }, prompt: String, options: [String], answer: Schema.Types.Mixed, marks: { type: Number, default: 1 } }],
  published: { type: Boolean, default: true },
}, options);

const examAttemptSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{ question: Schema.Types.ObjectId, value: Schema.Types.Mixed, marked: Boolean }],
  score: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  wrong: { type: Number, default: 0 },
  unanswered: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  status: { type: String, enum: ['in-progress', 'submitted', 'reviewed'], default: 'in-progress' },
  submittedAt: Date,
}, options);

const notebookSchema = new Schema({
  title: { type: String, required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  batch: { type: Schema.Types.ObjectId, ref: 'Batch' },
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  chapter: String,
  content: { type: String, default: '' },
  drawing: String,
  status: { type: String, enum: ['draft', 'live', 'saved'], default: 'draft' },
}, options);

const routineSchema = new Schema({
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  batch: { type: Schema.Types.ObjectId, ref: 'Batch' },
  subject: String,
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  day: String,
  startsAt: String,
  endsAt: String,
  type: { type: String, enum: ['live', 'recorded', 'offline', 'exam'], default: 'live' },
}, options);

const attendanceSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  batch: { type: Schema.Types.ObjectId, ref: 'Batch' },
  content: { type: Schema.Types.ObjectId, ref: 'Content' },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, options);

const qaSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User' },
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  subject: String,
  chapter: String,
  question: { type: String, required: true },
  attachment: String,
  answers: [{ author: { type: Schema.Types.ObjectId, ref: 'User' }, body: String, createdAt: { type: Date, default: Date.now } }],
  status: { type: String, enum: ['pending', 'answered', 'resolved'], default: 'pending' },
}, options);

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  role: String,
  type: String,
  title: { type: String, required: true },
  message: String,
  url: String,
  read: { type: Boolean, default: false },
}, options);

const paymentSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['manual', 'bkash', 'nagad', 'card'], default: 'manual' },
  transactionId: String,
  invoice: String,
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  expiresAt: Date,
}, options);

const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: Schema.Types.Mixed,
}, options);

const complaintSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  category: String,
  subject: { type: String, required: true },
  message: { type: String, required: true },
  reply: String,
  status: { type: String, enum: ['pending', 'under-review', 'in-progress', 'resolved'], default: 'pending' },
}, options);

export const User = model('User', userSchema);
export const Course = model('Course', courseSchema);
export const Batch = model('Batch', batchSchema);
export const Enrollment = model('Enrollment', enrollmentSchema);
export const Content = model('Content', contentSchema);
export const Exam = model('Exam', examSchema);
export const ExamAttempt = model('ExamAttempt', examAttemptSchema);
export const Notebook = model('Notebook', notebookSchema);
export const Routine = model('Routine', routineSchema);
export const Attendance = model('Attendance', attendanceSchema);
export const QA = model('QA', qaSchema);
export const Complaint = model('Complaint', complaintSchema);
export const Notification = model('Notification', notificationSchema);
export const Payment = model('Payment', paymentSchema);
export const Setting = model('Setting', settingSchema);
