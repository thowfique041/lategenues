# SRS implementation map

LateGenues now includes the application-owned implementation for every module in the supplied SRS. Provider-dependent features are exposed through URLs/records and can be connected to a chosen free-tier provider without changing the domain model.

## Public experience

- Home, courses, class-level routes, admission, teachers, books, notices, about, contact and FAQ
- Responsive navigation, social/contact placeholders and course filtering/search
- Public course, notice and book APIs

## Accounts and security

- Admin, teacher, student and guardian roles
- Email/phone identifier login, bcrypt password hashing, JWT sessions and protected routes
- Account activation status, temporary-password recovery request and role permissions

## Coaching operations

- Users and detailed profiles
- Courses, subjects, batches, enrollment and progress
- Live/recorded classes, materials, books, downloadable permissions and routines
- Attendance records with student/guardian-readable reporting
- Admin-manageable settings, notices, notifications and contact/social fields

## Learning

- Course content and progress records
- Live notebook editor/viewer with text/equation-ready content and persisted drawing field
- Q&A with attachments, replies and lifecycle status
- Global search across courses, classes, materials, notebooks, exams and Q&A

## Examinations and analytics

- MCQ, true/false, short and written question schemas
- Timed exam interface, question navigation, saved answers, review markers and auto-submit
- Automated objective scoring, negative marking, results and history
- Student/guardian analytics endpoint for exam average, attendance and completion

## Communication and finance

- Guardian complaints with full status workflow and history
- Role/user-targeted notifications
- Payment, transaction, invoice, subscription status and expiry records
- bKash, Nagad and card-ready method fields; a real merchant checkout requires provider credentials

## External adapters still requiring owner accounts

- SMS/email OTP delivery
- bKash/Nagad/card transaction confirmation
- Cloud file/video upload storage
- Live meeting provider

These integrations cannot process real messages, files, meetings or money until the owner selects a provider and authorizes that account.
