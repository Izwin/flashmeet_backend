import admin from '../config/firebase.js';
import User from '../models/User.js';

export const verifyTokenSocket = async (socket, next) => {
    const token = socket.handshake.headers.authorization;

    if (!token) {
        return next(new Error('Token not provided'));
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const email = decodedToken.email;

        const user = await User.findOne({ email });

        if (!user) {
            return next(new Error('User not found'));
        }

        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
};
