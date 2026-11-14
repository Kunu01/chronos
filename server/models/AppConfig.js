import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema(
  {
    masterPassword: {
      type: String,
      required: true,
    },
    secretWord: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    herPin: {
      type: String,
      required: true,
    },
    hisPin: {
      type: String,
      required: true,
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'app_configs',
    strict: true,
  }
);

const AppConfig = mongoose.model('AppConfig', appConfigSchema);
export default AppConfig;

