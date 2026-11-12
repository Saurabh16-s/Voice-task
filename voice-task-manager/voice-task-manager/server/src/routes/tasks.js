const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const taskService = require('../services/taskService');
const { createTaskSchema, updateTaskSchema } = require('../validators');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = ['todo', 'done'].includes(req.query.status) ? { status: req.query.status } : {};
    res.json({ tasks: await taskService.listTasks(req.userId, filter) });
  })
);

router.post(
  '/',
  validate(createTaskSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ task: await taskService.createTask(req.userId, req.body) });
  })
);

router.patch(
  '/:id',
  validate(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await taskService.updateTask(req.userId, req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await taskService.deleteTask(req.userId, req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.status(204).end();
  })
);

module.exports = router;
