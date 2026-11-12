// Measures intent-parsing accuracy against a labelled set of utterances.
// Run:  OPENAI_API_KEY=sk-... npm run eval:intents
// Use the printed numbers on your resume ("[X]% accuracy across [N] test utterances").
require('dotenv').config();
const { parseIntent } = require('../src/services/intentParser');

const TZ = 'Asia/Kolkata';

// expect: action must match; target/title are checked as case-insensitive "contains" when given.
const CASES = [
  { say: 'add buy groceries tomorrow at 6 pm', expect: { action: 'add', title: 'groceries' } },
  { say: 'remind me to call mom on Sunday morning', expect: { action: 'add', title: 'mom' } },
  { say: 'create a high priority task submit the assignment', expect: { action: 'add', title: 'assignment' } },
  { say: 'new task review pull requests', expect: { action: 'add', title: 'pull requests' } },
  { say: 'schedule a team meeting next Monday at 10', expect: { action: 'add', title: 'meeting' } },
  { say: 'delete the dentist task', expect: { action: 'delete', target: 'dentist' } },
  { say: 'remove gym from my list', expect: { action: 'delete', target: 'gym' } },
  { say: 'mark the project report as done', expect: { action: 'complete', target: 'report' } },
  { say: 'I finished the laundry', expect: { action: 'complete', target: 'laundry' } },
  { say: 'complete buy milk', expect: { action: 'complete', target: 'milk' } },
  { say: 'move the dentist appointment to Friday at 4', expect: { action: 'reschedule', target: 'dentist' } },
  { say: 'push gym to tomorrow evening', expect: { action: 'reschedule', target: 'gym' } },
  { say: 'reschedule the demo to next Wednesday', expect: { action: 'reschedule', target: 'demo' } },
  { say: 'rename groceries to buy vegetables', expect: { action: 'edit', target: 'groceries', title: 'vegetables' } },
  { say: 'make the report task high priority', expect: { action: 'edit', target: 'report' } },
  { say: 'what is due today', expect: { action: 'list' } },
  { say: 'show me all my tasks', expect: { action: 'list' } },
  { say: 'what is overdue', expect: { action: 'list' } },
  { say: 'what is the weather like', expect: { action: 'unknown' } },
  { say: 'tell me a joke', expect: { action: 'unknown' } },
];

const has = (value, needle) => String(value || '').toLowerCase().includes(needle.toLowerCase());

(async () => {
  let passed = 0;
  for (const { say, expect } of CASES) {
    const intent = await parseIntent(say, { timezone: TZ });
    const ok =
      intent.action === expect.action &&
      (!expect.target || has(intent.target, expect.target)) &&
      (!expect.title || has(intent.title, expect.title));
    if (ok) passed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  "${say}" -> ${JSON.stringify(intent)}`);
  }
  console.log(`\nIntent accuracy: ${passed}/${CASES.length} = ${((passed / CASES.length) * 100).toFixed(1)}%`);
})();
