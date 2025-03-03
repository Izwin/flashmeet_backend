import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import Message from './models/Message.js';
import sendNotification from "./utils/sendNotification.js";
import User from "./models/User.js";
import {verifyTokenSocket} from "./middleware/verifyTokenSocket.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

io.use(verifyTokenSocket);

io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user}`);

    socket.on('joinRoom', ({ meetingId }) => {
        socket.join(meetingId);
        console.log(`👥 User joined the meeting chat: ${meetingId}`);
    });

    socket.on('sendMessage', async ({ meetingId, text }) => {
        if (!text.trim()) return;

        const message = new Message({ meetingId, sender: socket.user, text });
        await message.save();

        io.to(meetingId).emit('newMessage', message);

        const users = await User.find({ _id: { $ne: socket.user.uid } });
        users.forEach(user => sendNotification(user._id, 'New message', text));
    });

    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.user.uid}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
