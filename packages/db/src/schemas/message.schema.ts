import { Schema } from 'mongoose'

const AttachmentSchema = new Schema(
  { type: { type: String, enum: ['video', 'file', 'image'] }, url: String, filename: String, size: Number },
  { _id: false }
)

export const MessageSchema = new Schema({
  threadId: { type: String, required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: String,
  attachments: [AttachmentSchema],
  readAt: Date,
}, { timestamps: { createdAt: true, updatedAt: false } })

MessageSchema.index({ threadId: 1, createdAt: 1 })
