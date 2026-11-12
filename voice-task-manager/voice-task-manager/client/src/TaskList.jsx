const fmt = (d) =>
  new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function TaskList({ tasks, onToggle, onDelete }) {
  if (!tasks.length) {
    return <p className="empty">No tasks yet. Hold the mic and say "add buy milk tomorrow at 6".</p>;
  }
  const now = Date.now();
  return (
    <ul className="tasks">
      {tasks.map((t) => {
        const overdue = t.status === 'todo' && t.dueDate && new Date(t.dueDate).getTime() < now;
        return (
          <li key={t._id} className={t.status === 'done' ? 'done' : ''}>
            <input type="checkbox" checked={t.status === 'done'} onChange={() => onToggle(t)} aria-label={`Mark ${t.title} done`} />
            <div className="body">
              <span className="title">{t.title}</span>
              {t.dueDate && <span className={`due ${overdue ? 'overdue' : ''}`}>{fmt(t.dueDate)}</span>}
            </div>
            <span className={`prio ${t.priority}`}>{t.priority}</span>
            <button className="icon" onClick={() => onDelete(t)} aria-label={`Delete ${t.title}`}>Delete</button>
          </li>
        );
      })}
    </ul>
  );
}
