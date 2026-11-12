const mongoose = require('mongoose');
const Task = require('../models/Task');

// Shared by the REST routes and the voice pipeline so both behave identically.

function sortTasks(tasks) {
  return tasks.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return ad - bd;
  });
}

async function createTask(userId, { title, dueDate, priority }) {
  return Task.create({
    user: userId,
    title,
    dueDate: dueDate ? new Date(dueDate) : null,
    priority: priority || 'medium',
  });
}

async function listTasks(userId, filter = {}) {
  const tasks = await Task.find({ ...filter, user: userId }).limit(500);
  return sortTasks(tasks);
}

async function updateTask(userId, id, patch) {
  if (!mongoose.isValidObjectId(id)) return null;
  const update = { ...patch };
  if (update.dueDate !== undefined) update.dueDate = update.dueDate ? new Date(update.dueDate) : null;
  return Task.findOneAndUpdate({ _id: id, user: userId }, update, { new: true, runValidators: true });
}

async function deleteTask(userId, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Task.findOneAndDelete({ _id: id, user: userId });
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'my', 'task', 'to', 'of', 'for']);
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Resolve a spoken phrase ("the dentist one") to the user's tasks.
// Returns every plausible match so the caller can ask "which one?" when there are several.
async function findMatches(userId, query) {
  const q = norm(query);
  const words = q.split(' ').filter((w) => w && !STOP_WORDS.has(w));
  if (!words.length) return [];
  const tasks = await Task.find({ user: userId }).limit(500);
  const exact = tasks.filter((t) => norm(t.title) === q);
  if (exact.length === 1) return exact;
  return sortTasks(tasks.filter((t) => words.every((w) => norm(t.title).includes(w))));
}

module.exports = { createTask, listTasks, updateTask, deleteTask, findMatches };
