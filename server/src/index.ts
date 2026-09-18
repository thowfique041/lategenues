import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { app } from './app.js';
import { Notebook, User } from './models.js';

const server = createServer(app);
const io = new Server(server, { cors: { origin: config.clientUrl.split(',').map(x => x.trim()), credentials: true } });
io.use(async (socket, next) => {
  try { const payload = jwt.verify(socket.handshake.auth?.token, config.jwtSecret) as jwt.JwtPayload; (socket as any).user = await User.findById(payload.sub); next(); }
  catch { next(new Error('Authentication required')); }
});
io.on('connection', (socket) => {
  socket.on('notebook:join', (id) => socket.join(`notebook:${id}`));
  socket.on('notebook:update', async ({ id, content, drawing }) => {
    if (!['admin', 'teacher'].includes((socket as any).user?.role)) return;
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
