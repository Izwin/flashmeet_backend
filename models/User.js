import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    avatar: String,
    bio: String,
    fcmToken: { type: String, default: null }, // Token for push notifications
});

const User = mongoose.model('User', userSchema);
export default User;
