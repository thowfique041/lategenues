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
  batch: String,
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
  instructor: { type: Schema.Types.ObjectId, ref: 'User' },
  price: { type: Number, default: 0 },
  thumbnail: String,
  featured: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
}, options);

const contentSchema = new Schema({
  type: { type: String, enum: ['live-class', 'recording', 'material', 'book', 'notice'], required: true },
  title: { type: String, required: true },
  description: String,
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  chapter: String,
  url: String,
  fileType: String,
  startsAt: Date,
  duration: Number,
  published: { type: Boolean, default: true },
}, options);

const examSchema = new Schema({
  title: { type: String, required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  duration: { type: Number, default: 30 },
  totalMarks: { type: Number, default: 100 },
  startsAt: Date,
  questions: [{ prompt: String, options: [String], answer: Number, marks: { type: Number, default: 1 } }],
  published: { type: Boolean, default: true },
}, options);

const qaSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User' },
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  course: { type: Schema.Types.ObjectId, ref: 'Course' },
  question: { type: String, required: true },
  answer: String,
  status: { type: String, enum: ['pending', 'answered', 'resolved'], default: 'pending' },
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
export const Content = model('Content', contentSchema);
export const Exam = model('Exam', examSchema);
export const QA = model('QA', qaSchema);
export const Complaint = model('Complaint', complaintSchema);
