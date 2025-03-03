import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/:meetingId/messages', verifyToken, async (req, res) => {
    const { meetingId } = req.params;
    const { lastMessageDate, limit = 20 } = req.query;

    try {
        const query = { meetingId };

        if (lastMessageDate) {
            query.createdAt = { $lt: new Date(lastMessageDate) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('sender', 'name email avatar');

        res.json({
            messages,
            lastMessageDate: messages.length > 0 ? messages[messages.length - 1].createdAt : null,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

export default router;
