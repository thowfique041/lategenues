# LateGenues

A full-stack coaching management and online learning platform for classes 6–12 and admission candidates.

## Included modules

- Public marketing website and course catalogue
- Role-based Admin, Teacher, Student and Guardian dashboards
- Courses, batches, live/recorded classes, materials and PDF books
- Exams, results, attendance, Q&A, complaints and notices
- JWT authentication and MongoDB data models
- Responsive, accessible React interface

## Run locally

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and `JWT_SECRET`.
2. Run `npm install`.
3. Run `npm run seed` to add demo accounts and sample data.
4. Run `npm run dev`.

Frontend: `http://localhost:5173` · API: `http://localhost:5000/api`

## Demo accounts after seeding

All demo accounts use password `Demo@123`.

- `admin@lategenues.com`
- `teacher@lategenues.com`
- `student@lategenues.com`
- `guardian@lategenues.com`

## Free-tier deployment

- Frontend: Vercel or Cloudflare Pages
- API: Render
- Database: MongoDB Atlas M0
- Media/PDF: Cloudinary free tier or external video links
