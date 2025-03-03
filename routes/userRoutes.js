import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import admin from '../config/firebase.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const upload = multer({ dest: 'uploads/avatars'});

router.post('/auth', async (req, res) => {
    const { token } = req.body;

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { email, name, picture } = decodedToken;

        let user = await User.findOne({ email });

        if (!user) {
            user = new User({
                email,
                name,
                avatar: picture || 'default-avatar.jpg',
            });

            await user.save();
        }

        res.json(user);
    } catch (error) {
        res.status(400).json({ message: 'Authorization error' });
    }
});

router.post('/update-fcm-token', verifyToken, async (req, res) => {
    const { fcmToken } = req.body;
    const userId = req.user.id;

    if (!fcmToken) {
        return res.status(400).json({ message: 'FCM token is required' });
    }

    try {
        await User.findByIdAndUpdate(userId, { fcmToken });
        res.json({ message: 'FCM token updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating FCM token' });
    }
});

router.put('/profile', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { name, bio } = req.body;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.name = name || user.name;
        user.bio = bio || user.bio;

        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile' });
    }
});

router.get('/profile', verifyToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

router.put('/avatar', verifyToken, upload.single('avatar'), async (req, res) => {
    const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({ message: 'File not uploaded' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.avatar && !user.avatar.includes('default-avatar.jpg')) {
            const oldAvatarPath = path.join(__dirname, '../uploads/avatars', path.basename(user.avatar));
            try {
                await fs.unlink(oldAvatarPath);
            } catch (err) {
                console.warn(`Failed to delete old avatar: ${err.message}`);
            }
        }

        const avatarUrl = `http://127.0.0.1:3000/uploads/avatars/${req.file.filename}`;

        user.avatar = avatarUrl;
        await user.save();

        res.json({ message: 'Avatar updated', avatar: avatarUrl });
    } catch (error) {
        res.status(500).json({ message: 'Error updating avatar' });
    }
});

router.delete('/avatar', verifyToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.avatar === 'default-avatar.jpg') {
            return res.status(400).json({ message: 'Cannot delete default avatar' });
        }

        const avatarPath = path.join(__dirname, '../uploads', user.avatar);
        try {
            await fs.unlink(avatarPath);
        } catch (err) {
            console.warn(`Error deleting avatar: ${err.message}`);
        }

        user.avatar = 'default-avatar.jpg';
        await user.save();

        res.json({ message: 'Avatar deleted', avatar: user.avatar });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting avatar' });
    }
});

export default router;
