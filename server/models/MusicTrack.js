import mongoose from 'mongoose';

const musicTrackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      default: 'Ambient Soundscape',
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'music_tracks' }
);

const MusicTrack = mongoose.model('MusicTrack', musicTrackSchema);
export default MusicTrack;
