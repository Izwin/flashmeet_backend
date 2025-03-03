import Meeting from './models/Meeting.js';
import cron from 'node-cron';

const checkMeetings = async () => {
    try {
        const now = new Date();

        const expiredMeetings = await Meeting.find({
            isFinished: false,
        });

        let meetingsToUpdate = [];

        expiredMeetings.forEach(meeting => {
            const meetingEnd = new Date(meeting.date.getTime() + 2 * 60 * 60 * 1000);

            if (now >= meetingEnd) {
                meetingsToUpdate.push(meeting._id);
            }
        });

        if (meetingsToUpdate.length > 0) {
            await Meeting.updateMany(
                { _id: { $in: meetingsToUpdate } },
                { $set: { isFinished: true } }
            );
            console.log(`✅ Updated ${meetingsToUpdate.length} meetings as finished.`);
        }
    } catch (error) {
        console.error('Error checking meetings:', error);
    }
};

cron.schedule('*/1 * * * *', () => {
    console.log('🔍 Checking meetings...');
    checkMeetings();
});
