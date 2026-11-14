import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    senderRole: {
      type: String,
      enum: ['PARTNER_HER', 'PARTNER_HIM'],
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'audio'],
      default: 'text',
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    cloudinaryPublicId: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
      index: { expires: 86400 }, // Native 24-hour TTL index
    },
  },
  {
    collection: 'chat_messages',
    strict: true,
  }
);

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export default ChatMessage;
