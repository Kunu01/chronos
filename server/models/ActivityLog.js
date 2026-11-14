import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    actor: {
      type: String,
      enum: ['PARTNER_HER', 'PARTNER_HIM', 'ADMIN', 'SYSTEM'],
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: -1,
    },
  },
  {
    collection: 'activity_logs',
    strict: true,
    capped: { size: 524288, max: 1000 },
  }
);

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;

