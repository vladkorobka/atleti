import { Schema } from 'mongoose'

export const ContentSchema = new Schema({
  coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['all', 'client'], default: 'all' },
  targetId: { type: Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['video', 'file'], required: true },
  cloudflareVideoId: String,
  fileUrl: String,
}, { timestamps: { createdAt: true, updatedAt: false } })
