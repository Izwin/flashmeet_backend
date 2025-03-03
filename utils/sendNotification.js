import admin from '../config/firebase.js';
import User from "../models/User.js";

const sendNotification = async (userId, title, body) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.fcmToken) return;

        const message = {
            token: user.fcmToken,
            notification: {
                title,
                body,
            },
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                    },
                },
            },
        };

        await admin.messaging().send(message);
        console.log(`✅ Уведомление отправлено пользователю ${userId}`);
    } catch (error) {
        console.error('❌ Ошибка отправки уведомления:', error);
    }
};

export default sendNotification;
