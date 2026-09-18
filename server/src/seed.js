import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { Complaint, Content, Course, Exam, QA, User } from './models.js';

await mongoose.connect(config.mongoUri);
await Promise.all([User.deleteMany({}), Course.deleteMany({}), Content.deleteMany({}), Exam.deleteMany({}), QA.deleteMany({}), Complaint.deleteMany({})]);
const password = await bcrypt.hash('Demo@123', 12);
const [admin, teacher, student, guardian] = await User.create([
  { name: 'LateGenues Admin', email: 'admin@lategenues.com', password, role: 'admin' },
  { name: 'Nafis Rahman', email: 'teacher@lategenues.com', password, role: 'teacher' },
  { name: 'Ayman Hasan', email: 'student@lategenues.com', password, role: 'student', classLevel: 'Class 10', batch: 'SSC 2027' },
  { name: 'Farhana Hasan', email: 'guardian@lategenues.com', password, role: 'guardian' },
]);
const courses = await Course.create([
  { title: 'SSC 2027 Complete Science', slug: 'ssc-2027-science', summary: 'Physics, Chemistry, Biology and Higher Mathematics in one focused program.', category: 'academic', classLevel: 'Class 10', subjects: ['Physics', 'Chemistry', 'Biology', 'Higher Math'], instructor: teacher.id, featured: true, price: 2500 },
  { title: 'HSC Physics Masterclass', slug: 'hsc-physics', summary: 'Concept-first HSC Physics with live problem solving and model tests.', category: 'academic', classLevel: 'Class 11–12', subjects: ['Physics'], instructor: teacher.id, featured: true, price: 1800 },
  { title: 'University Admission A Unit', slug: 'admission-a-unit', summary: 'Complete university admission preparation with weekly model tests.', category: 'admission', classLevel: 'Admission', subjects: ['Physics', 'Chemistry', 'Math', 'Biology'], instructor: teacher.id, featured: true, price: 3200 },
]);
await Content.create([
  { type: 'live-class', title: "Newton's Laws: Live Problem Solving", course: courses[0].id, teacher: teacher.id, subject: 'Physics', chapter: 'Force', startsAt: new Date(Date.now() + 86400000), duration: 90, url: 'https://meet.google.com/' },
  { type: 'recording', title: 'Motion and Measurement', course: courses[0].id, teacher: teacher.id, subject: 'Physics', chapter: 'Motion', duration: 42, url: 'https://youtube.com/' },
  { type: 'material', title: 'Physics Chapter 3 Lecture Sheet', course: courses[0].id, teacher: teacher.id, subject: 'Physics', fileType: 'PDF', url: '#' },
  { type: 'book', title: 'SSC Physics Question Bank', course: courses[0].id, fileType: 'PDF', url: '#' },
  { type: 'notice', title: 'SSC 2027 batch admission is now open', description: 'Limited seats are available for the new batch.' },
]);
await Exam.create({ title: 'Weekly Physics Model Test', course: courses[0].id, duration: 30, totalMarks: 20, startsAt: new Date(Date.now() + 172800000), questions: [{ prompt: 'What is the SI unit of force?', options: ['Joule', 'Newton', 'Watt', 'Pascal'], answer: 1, marks: 1 }] });
await QA.create({ student: student.id, teacher: teacher.id, course: courses[0].id, question: 'Why does acceleration increase when force increases?', answer: 'From F = ma, for constant mass acceleration is proportional to force.', status: 'answered' });
await Complaint.create({ author: guardian.id, category: 'Attendance', subject: 'Attendance record clarification', message: 'Please confirm the last Friday class attendance.', status: 'under-review' });
console.log('Seed complete. Demo password: Demo@123');
await mongoose.disconnect();
