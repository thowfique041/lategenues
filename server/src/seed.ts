import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { Batch, Complaint, Content, Course, Enrollment, Exam, ExamAttempt, Notebook, Notification, Payment, QA, Routine, Setting, User } from './models.js';

await mongoose.connect(config.mongoUri);
await Promise.all([User.deleteMany({}), Course.deleteMany({}), Batch.deleteMany({}), Enrollment.deleteMany({}), Content.deleteMany({}), Exam.deleteMany({}), ExamAttempt.deleteMany({}), Notebook.deleteMany({}), Routine.deleteMany({}), QA.deleteMany({}), Complaint.deleteMany({}), Notification.deleteMany({}), Payment.deleteMany({}), Setting.deleteMany({})]);
const password = await bcrypt.hash('Demo@123', 12);
const [admin, teacher, student, guardian] = await User.create([
  { name: 'LateGenues Admin', email: 'admin@lategenues.com', password, role: 'admin' },
  { name: 'Nafis Rahman', email: 'teacher@lategenues.com', password, role: 'teacher' },
  { name: 'Ayman Hasan', email: 'student@lategenues.com', password, role: 'student', classLevel: 'Class 10', batch: 'SSC 2027' },
  { name: 'Farhana Hasan', email: 'guardian@lategenues.com', password, role: 'guardian' },
]);
guardian.guardianOf = student.id; await guardian.save();
const courses = await Course.create([
  { title: 'SSC 2027 Complete Science', slug: 'ssc-2027-science', summary: 'Physics, Chemistry, Biology and Higher Mathematics in one focused program.', category: 'academic', classLevel: 'Class 10', subjects: ['Physics', 'Chemistry', 'Biology', 'Higher Math'], instructor: teacher.id, featured: true, price: 2500 },
  { title: 'HSC Physics Masterclass', slug: 'hsc-physics', summary: 'Concept-first HSC Physics with live problem solving and model tests.', category: 'academic', classLevel: 'Class 11–12', subjects: ['Physics'], instructor: teacher.id, featured: true, price: 1800 },
  { title: 'University Admission A Unit', slug: 'admission-a-unit', summary: 'Complete university admission preparation with weekly model tests.', category: 'admission', classLevel: 'Admission', subjects: ['Physics', 'Chemistry', 'Math', 'Biology'], instructor: teacher.id, featured: true, price: 3200 },
]);
const batch = await Batch.create({ name: 'SSC 2027 Batch A', course: courses[0].id, teachers: [teacher.id], students: [student.id], startsAt: new Date(), active: true });
await Enrollment.create({ student: student.id, course: courses[0].id, batch: batch.id, progress: 68 });
await Content.create([
  { type: 'live-class', title: "Newton's Laws: Live Problem Solving", course: courses[0].id, batch: batch.id, teacher: teacher.id, subject: 'Physics', chapter: 'Force', startsAt: new Date(Date.now() + 86400000), duration: 90, status: 'upcoming', url: 'https://meet.google.com/' },
  { type: 'recording', title: 'Motion and Measurement', course: courses[0].id, teacher: teacher.id, subject: 'Physics', chapter: 'Motion', duration: 42, url: 'https://youtube.com/' },
  { type: 'material', title: 'Physics Chapter 3 Lecture Sheet', course: courses[0].id, teacher: teacher.id, subject: 'Physics', fileType: 'PDF', url: '#' },
  { type: 'book', title: 'SSC Physics Question Bank', course: courses[0].id, fileType: 'PDF', url: '#' },
  { type: 'notice', title: 'SSC 2027 batch admission is now open', description: 'Limited seats are available for the new batch.' },
]);
await Exam.create({ title: 'Weekly Physics Model Test', course: courses[0].id, batch: batch.id, subject: 'Physics', duration: 30, totalMarks: 2, passMarks: 1, startsAt: new Date(Date.now() + 172800000), questions: [{ prompt: 'What is the SI unit of force?', options: ['Joule', 'Newton', 'Watt', 'Pascal'], answer: 1, marks: 1 }, { type: 'true-false', prompt: 'Force equals mass multiplied by acceleration.', options: ['True','False'], answer: 0, marks: 1 }] });
await QA.create({ student: student.id, teacher: teacher.id, course: courses[0].id, question: 'Why does acceleration increase when force increases?', answer: 'From F = ma, for constant mass acceleration is proportional to force.', status: 'answered' });
await Complaint.create({ author: guardian.id, category: 'Class schedule', subject: 'Class schedule clarification', message: 'Please confirm the next Friday class time.', status: 'under-review' });
await Notebook.create({ title: "Newton's Laws — Live Notebook", course: courses[0].id, batch: batch.id, teacher: teacher.id, subject: 'Physics', chapter: 'Force', status: 'saved', content: "Newton's Second Law\n\nF = ma\n\nForce = Mass × Acceleration\n\nExample: A 2 kg body accelerating at 3 m/s² needs 6 N force." });
await Routine.create([{ course: courses[0].id, batch: batch.id, subject: 'Physics', teacher: teacher.id, day: 'Saturday', startsAt: '20:00', endsAt: '21:30', type: 'live' }, { course: courses[0].id, batch: batch.id, subject: 'Chemistry', teacher: teacher.id, day: 'Sunday', startsAt: '20:00', endsAt: '21:30', type: 'live' }]);
await Notification.create([{ user: student.id, course: courses[0].id, type: 'RECORDING', title: 'New Physics class uploaded', message: 'Motion and Measurement is ready to watch.', url: '/course/' + courses[0].id + '?tab=recordings' }, { user: student.id, course: courses[0].id, batch: batch.id, type: 'EXAM', title: 'Upcoming model test', message: 'Your weekly Physics test starts soon.', url: '/course/' + courses[0].id + '?tab=exams' }]);
await Payment.create({ student: student.id, course: courses[0].id, amount: 2500, method: 'manual', transactionId: 'DEMO-001', invoice: 'LG-DEMO-001', status: 'paid', expiresAt: new Date(Date.now() + 31536000000) });
await Setting.create([{ key: 'phone', value: '+880 0000-000000' }, { key: 'email', value: 'hello@lategenues.com' }, { key: 'address', value: 'Dhaka, Bangladesh' }, { key: 'facebook', value: '#' }, { key: 'youtube', value: '#' }, { key: 'whatsapp', value: '#' }]);
console.log('Seed complete. Demo password: Demo@123');
await mongoose.disconnect();
