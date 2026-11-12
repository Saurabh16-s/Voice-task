const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['todo', 'done'], default: 'todo' },
  },
  { timestamps: true }
);

taskSchema.index({ user: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
