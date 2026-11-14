import mongoose from 'mongoose';

const assetEmbeddedSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['photo', 'audio', 'video'],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      default: '',
    },
    displayType: {
      type: String,
      enum: ['billboard', 'coupe-table'],
      default: 'billboard',
    },
  },
  { _id: false }
);

const memoryStationSchema = new mongoose.Schema(
  {
    trackOrder: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    stationTitle: {
      type: String,
      required: true,
      trim: true,
    },
    milestoneDate: {
      type: Date,
      required: true,
    },
    environmentTheme: {
      type: String,
      enum: ['autumn-night', 'rainy-neon', 'sunset', 'midnight', 'stars'],
      default: 'autumn-night',
      required: true,
    },
    secretLetter: {
      type: String,
      default: '',
    },
    assets: {
      type: [assetEmbeddedSchema],
      default: [],
    },
  },
  {
    collection: 'memory_stations',
    strict: true,
  }
);

const MemoryStation = mongoose.model('MemoryStation', memoryStationSchema);
export default MemoryStation;

