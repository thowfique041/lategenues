import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { app } from './app.js';
import { Batch, Course, Enrollment, Notebook, User } from './models.js';

const server = createServer(app);
const io = new Server(server, { cors: { origin: config.clientUrl.split(',').map(x => x.trim()), credentials: true } });
io.use(async (socket, next) => {
  try { const payload = jwt.verify(socket.handshake.auth?.token, config.jwtSecret) as jwt.JwtPayload; (socket as any).user = await User.findById(payload.sub); next(); }
  catch { next(new Error('Authentication required')); }
});
io.on('connection', (socket) => {
  socket.on('notebook:join', async (id) => {
    const note = await Notebook.findById(id).select('course batch');
    const user = (socket as any).user;
    if (!note) return;
    if (user.role === 'teacher' && !await Course.exists({ _id: note.course, instructor: user.id }) && !await Batch.exists({ ...(note.batch ? { _id: note.batch } : {}), course: note.course, teachers: user.id, active: true })) return;
    if (['student', 'guardian'].includes(user.role)) {
      const student = user.role === 'guardian' ? user.guardianOf : user.id;
      if (!await Enrollment.exists({ student, course: note.course, ...(note.batch ? { batch: note.batch } : {}), status: { $in: ['active', 'completed'] } })) return;
    }
    socket.join(`notebook:${id}`);
  });
  socket.on('notebook:update', async ({ id, content, drawing }) => {
    if (!['admin', 'teacher'].includes((socket as any).user?.role)) return;
    const author = (socket as any).user;
    const existing = await Notebook.findById(id);
    if (!existing) return;
    if (author.role === 'teacher' && !await Course.exists({ _id: existing.course, instructor: author.id }) && !await Batch.exists({ ...(existing.batch ? { _id: existing.batch } : {}), course: existing.course, teachers: author.id, active: true })) return;
    const note = await Notebook.findByIdAndUpdate(id, { content, drawing, status: 'live' }, { new: true });
    if (note) io.to(`notebook:${id}`).emit('notebook:changed', { id, content: note.content, drawing: note.drawing, updatedAt: (note as any).updatedAt });
  });
});

mongoose.connect(config.mongoUri).then(() => {
  server.listen(config.port, () => console.log(`LateGenues API running on :${config.port}`));
}).catch((error) => {
  console.error('Database connection failed:', error.message);
  process.exit(1);
});
