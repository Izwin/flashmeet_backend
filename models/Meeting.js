import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isFinished: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
}, { timestamps: true });

meetingSchema.index({ location: '2dsphere' });

const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;
