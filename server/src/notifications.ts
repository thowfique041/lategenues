import { Enrollment, Notification } from './models.js';

export const activeEnrollment = () => ({ status: { $in: ['active', 'completed'] }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }] });

export async function deliverCourseUpdate({ course, batch, type, title, message, relatedContent, url }: { course: any; batch?: any; type: string; title: string; message?: string; relatedContent?: any; url: string }) {
  if (!course) throw new Error('A course is required for private notifications');
  const enrolled = await Enrollment.find({ course, ...activeEnrollment(), ...(batch ? { batch } : {}) }).select('student batch');
  const recipients = [...new Set(enrolled.map(x => String(x.student)))];
  if (!recipients.length) return 0;
  await Notification.insertMany(recipients.map(user => ({ user, course, batch: batch || null, type, title, message, relatedContent, url, read: false })), { ordered: false });
  return recipients.length;
}
