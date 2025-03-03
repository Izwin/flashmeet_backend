import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import sendNotification from '../utils/sendNotification.js';

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
    const { title, description, date, latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!title || !date || !latitude || !longitude) {
        return res.status(400).json({ message: 'Fill in all required fields' });
    }

    const meetingDate = new Date(date);
    if (isNaN(meetingDate)) {
        return res.status(400).json({ message: 'Invalid date format' });
    }

    try {
        const meeting = new Meeting({
            title,
            description,
            date: meetingDate,
            location: {
                type: 'Point',
                coordinates: [longitude, latitude],
            },
            attendees: [userId],
            admin: userId,
        });

        await meeting.save();

        const populatedMeeting = await Meeting.findById(meeting._id)
            .populate('attendees', 'name email avatar bio')
            .populate('admin', 'name email avatar bio');

        res.status(201).json({
            ...populatedMeeting.toObject(),
            latitude,
            longitude,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating the meeting' });
    }
});

router.post('/:meetingId/join', verifyToken, async (req, res) => {
    const { meetingId } = req.params;
    const userId = req.user.id;

    try {
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        if (meeting.attendees.includes(userId)) {
            return res.status(400).json({ message: 'You are already participating' });
        }

        meeting.attendees.push(userId);
        await meeting.save();

        const user = await User.findById(userId);
        const userName = user ? user.name : 'Someone';

        const usersToNotify = await User.find({ _id: { $in: meeting.attendees, $ne: userId } });
        usersToNotify.forEach(user => {
            sendNotification(user._id, 'New participant!', `${userName} joined the meeting "${meeting.title}"`);
        });

        res.json({ message: 'You joined the meeting!', meeting });
    } catch (error) {
        res.status(500).json({ message: 'Error joining the meeting' });
    }
});

router.post('/:meetingId/leave', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { meetingId } = req.params;

    try {
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        if (!meeting.attendees.includes(userId)) {
            return res.status(400).json({ message: 'You are not participating in this meeting' });
        }

        if (meeting.admin.equals(userId)) {
            return res.status(400).json({ message: 'Transfer admin rights before leaving' });
        }

        meeting.attendees = meeting.attendees.filter(id => id.toString() !== userId);
        await meeting.save();

        res.json({ message: 'You left the meeting' });
    } catch (error) {
        res.status(500).json({ message: 'Error leaving the meeting' });
    }
});

router.get('/past', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const pastMeetings = await Meeting.find({
            attendees: userId,
            date: { $lt: new Date() },
        })
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .populate('attendees', 'name email avatar bio')
            .populate('admin', 'name email avatar bio');

        const totalMeetings = await Meeting.countDocuments({
            attendees: userId,
            date: { $lt: new Date() },
        });

        res.json({
            totalMeetings,
            totalPages: Math.ceil(totalMeetings / limit),
            currentPage: page,
            meetings: pastMeetings,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching past meetings' });
    }
});

router.get('/current', verifyToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const currentMeetings = await Meeting.find({
            attendees: userId,
            isFinished: false,
        })
            .sort({ date: 1 })
            .populate('attendees', 'name email avatar bio')
            .populate('admin', 'name email avatar bio');

        res.json(currentMeetings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching current meetings' });
    }
});

router.get('/:meetingId', async (req, res) => {
    const { meetingId } = req.params;

    try {
        const meeting = await Meeting.findById(meetingId)
            .populate('attendees', 'name email avatar bio')
            .populate('admin', 'name email avatar bio');

        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        const longitude = meeting.location?.coordinates[0];
        const latitude = meeting.location?.coordinates[1];

        res.json({
            ...meeting.toObject(),
            latitude,
            longitude,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching the meeting' });
    }
});

router.post('/:meetingId/kick', verifyToken, async (req, res) => {
    const { meetingId } = req.params;
    const { userIdToKick } = req.body;
    const userId = req.user.id;

    try {
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        if (!meeting.admin.equals(userId)) {
            return res.status(403).json({ message: 'Only the admin can kick participants' });
        }

        if (!meeting.attendees.includes(userIdToKick)) {
            return res.status(400).json({ message: 'This user is not participating in the meeting' });
        }

        if (userIdToKick === userId) {
            return res.status(400).json({ message: 'Admin cannot kick themselves' });
        }

        meeting.attendees = meeting.attendees.filter(id => id.toString() !== userIdToKick);
        await meeting.save();

        sendNotification(userIdToKick, 'You were kicked', `You were kicked from the meeting "${meeting.title}"`);

        res.json({ message: 'User kicked', meeting });
    } catch (error) {
        res.status(500).json({ message: 'Error kicking the participant' });
    }
});

router.post('/:meetingId/transfer-admin', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const { newAdminId } = req.body;

    try {
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        if (!meeting.admin.equals(userId)) {
            return res.status(403).json({ message: 'You are not the admin' });
        }

        if (!meeting.attendees.includes(newAdminId)) {
            return res.status(400).json({ message: 'Selected user is not a participant' });
        }

        meeting.admin = newAdminId;
        await meeting.save();

        res.json({ message: 'Admin rights transferred' });
    } catch (error) {
        res.status(500).json({ message: 'Error transferring rights' });
    }
});

router.post('/:meetingId/cancel', verifyToken, async (req, res) => {
    const { meetingId } = req.params;
    const userId = req.user.id;

    try {
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        if (!meeting.admin.equals(userId)) {
            return res.status(403).json({ message: 'Only admin can cancel the meeting' });
        }

        await Meeting.findByIdAndDelete(meetingId);

        const users = await User.find({ _id: { $in: meeting.attendees } });
        users.forEach(user => sendNotification(user._id, 'Meeting cancelled', `The meeting "${meeting.title}" was cancelled`));

        res.json({ message: 'Meeting cancelled' });
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling the meeting' });
    }
});

router.get('/', async (req, res) => {
    const { latitude, longitude, radius = 5000 } = req.query;

    try {
        let query = { isFinished: false, isCancelled: false };

        if (latitude && longitude) {
            query.location = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                    $maxDistance: parseInt(radius),
                },
            };
        }

        const meetings = await Meeting.find(query).populate('attendees', 'name email avatar bio')
            .populate('admin', 'name email avatar bio');
        const formattedMeetings = meetings.map(meeting => ({
            ...meeting.toObject(),
            latitude: meeting.location?.coordinates[1],
            longitude: meeting.location?.coordinates[0],
        }));

        res.json(formattedMeetings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching meetings' });
    }
});

export default router;
