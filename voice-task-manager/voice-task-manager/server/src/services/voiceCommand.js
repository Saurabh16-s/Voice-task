const taskService = require('./taskService');
const { localNowString, localToUtc } = require('../utils/time');

const fmt = (d, tz) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }) : null;

const error = (message) => ({ type: 'error', message });

async function listForFilter(userId, filter = 'all', timezone = 'UTC') {
  const now = new Date();
  switch (filter) {
    case 'pending':
      return taskService.listTasks(userId, { status: 'todo' });
    case 'done':
      return taskService.listTasks(userId, { status: 'done' });
    case 'overdue':
      return taskService.listTasks(userId, { status: 'todo', dueDate: { $lt: now } });
    case 'today': {
      const start = localToUtc(`${localNowString(timezone, now).slice(0, 10)}T00:00`, timezone);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return taskService.listTasks(userId, { status: 'todo', dueDate: { $gte: start, $lt: end } });
    }
    default:
      return taskService.listTasks(userId);
  }
}

// Apply an edit/delete/complete/reschedule intent to one specific task.
async function applyToTask(userId, intent, task, timezone) {
  const id = task._id;
  switch (intent.action) {
    case 'delete': {
      await taskService.deleteTask(userId, id);
      return { type: 'deleted', task, message: `Deleted "${task.title}"` };
    }
    case 'complete': {
      const t = await taskService.updateTask(userId, id, { status: 'done' });
      return { type: 'updated', task: t, message: `Marked "${t.title}" as done` };
    }
    case 'reschedule': {
      if (!intent.dueDate) return error('When should I move it to?');
      const t = await taskService.updateTask(userId, id, { dueDate: intent.dueDate });
      return { type: 'updated', task: t, message: `Moved "${t.title}" to ${fmt(t.dueDate, timezone)}` };
    }
    case 'edit': {
      const patch = {};
      if (intent.title) patch.title = intent.title;
      if (intent.dueDate) patch.dueDate = intent.dueDate;
      if (intent.priority) patch.priority = intent.priority;
      if (!Object.keys(patch).length) return error('What should I change about it?');
      const t = await taskService.updateTask(userId, id, patch);
      return { type: 'updated', task: t, message: `Updated "${t.title}"` };
    }
    default:
      return error('Unsupported action');
  }
}

// Turn a parsed intent into a result. Ambiguous targets come back as type "clarify"
// so the client can ask "which one?" instead of guessing.
async function executeIntent(userId, intent, { timezone = 'UTC' } = {}) {
  switch (intent.action) {
    case 'add': {
      if (!intent.title) return error('What should the task be called?');
      const task = await taskService.createTask(userId, intent);
      const due = task.dueDate ? ` for ${fmt(task.dueDate, timezone)}` : '';
      return { type: 'created', task, message: `Added "${task.title}"${due}` };
    }
    case 'list': {
      const tasks = await listForFilter(userId, intent.filter || 'all', timezone);
      return { type: 'list', tasks, message: `${tasks.length} task${tasks.length === 1 ? '' : 's'}` };
    }
    case 'edit':
    case 'delete':
    case 'complete':
    case 'reschedule': {
      if (!intent.target) return error('Which task do you mean?');
      const matches = await taskService.findMatches(userId, intent.target);
      if (matches.length === 0) return error(`No task matches "${intent.target}"`);
      if (matches.length > 1) {
        return {
          type: 'clarify',
          message: `Which one did you mean by "${intent.target}"?`,
          candidates: matches.slice(0, 5),
          pending: intent,
        };
      }
      return applyToTask(userId, intent, matches[0], timezone);
    }
    default:
      return error("That didn't sound like a task command. Try \"add buy milk tomorrow at 6\".");
  }
}

// Second step of a clarification: the user picked one of the candidates.
async function applyPending(userId, intent, taskId, { timezone = 'UTC' } = {}) {
  const matches = await taskService.findMatches(userId, intent.target);
  const task = matches.find((t) => String(t._id) === String(taskId));
  if (!task) return error('That task is no longer available');
  return applyToTask(userId, intent, task, timezone);
}

module.exports = { executeIntent, applyPending };
