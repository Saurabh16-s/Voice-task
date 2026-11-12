const OpenAI = require('openai');
const { z } = require('zod');
const config = require('../config');
const { localToUtc, localNowString, weekdayName } = require('../utils/time');

const intentSchema = z.object({
  action: z.enum(['add', 'edit', 'delete', 'complete', 'reschedule', 'list', 'unknown']),
  title: z.string().max(200).nullish(),
  target: z.string().max(200).nullish(),
  dueDate: z.string().max(40).nullish(),
  priority: z.enum(['low', 'medium', 'high']).nullish(),
  filter: z.enum(['all', 'today', 'overdue', 'pending', 'done']).nullish(),
});

const UNKNOWN = { action: 'unknown' };

function buildSystemPrompt({ timezone, now }) {
  return `You convert a spoken task-management command into JSON. Reply with JSON only.

Current local time: ${localNowString(timezone, now)} (${weekdayName(timezone, now)}), timezone ${timezone}.

Schema:
{
  "action": "add" | "edit" | "delete" | "complete" | "reschedule" | "list" | "unknown",
  "title": string | null,      // add: the new task title. edit: the NEW title, only when renaming.
  "target": string | null,     // edit/delete/complete/reschedule: words that identify the EXISTING task
  "dueDate": string | null,    // LOCAL time as "YYYY-MM-DDTHH:mm" with no offset; resolve "tomorrow", "next Friday", "in 2 hours" from the current time above
  "priority": "low" | "medium" | "high" | null,
  "filter": "all" | "today" | "overdue" | "pending" | "done" | null   // list only
}

Rules:
- "add a meeting tomorrow at 5" -> add, title "Meeting", dueDate tomorrow 17:00.
- "mark the dentist one done" -> complete, target "dentist".
- "move gym to Friday evening" -> reschedule, target "gym", dueDate Friday 18:00.
- "rename groceries to buy vegetables" -> edit, target "groceries", title "Buy vegetables".
- "what's due today" -> list, filter "today".
- Use null for anything not mentioned. Never invent a target. If the text is not a task command, use "unknown".`;
}

let defaultClient;
function getClient() {
  if (!defaultClient) defaultClient = new OpenAI({ apiKey: config.openaiKey });
  return defaultClient;
}

// Converts a transcript into a validated, structured intent. Never throws on bad model output.
async function parseIntent(transcript, { timezone = 'UTC', client, now = new Date() } = {}) {
  const llm = client || getClient();
  const completion = await llm.chat.completions.create({
    model: config.openaiModel,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt({ timezone, now }) },
      { role: 'user', content: transcript },
    ],
  });

  let raw;
  try {
    raw = JSON.parse(completion.choices[0].message.content);
  } catch {
    return UNKNOWN;
  }
  const parsed = intentSchema.safeParse(raw);
  if (!parsed.success) return UNKNOWN;

  const intent = parsed.data;
  if (intent.dueDate) {
    const d = localToUtc(intent.dueDate, timezone);
    intent.dueDate = d ? d.toISOString() : null;
  }
  return intent;
}

module.exports = { parseIntent, intentSchema };
