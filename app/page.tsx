'use client';

import Link from 'next/link';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { ArrowLeft, Bell, CheckSquare, ChevronLeft, ChevronRight, Pencil, Plus, Search, SquareX, Trash2, X } from 'lucide-react';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Task = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  priority: Priority | null;
  completed: boolean;
  remindedFor: string | null;
};

const emptyForm = { title: '', description: '', date: '', priority: '' };
function midnight(date: Date) {
  return date.setHours(0, 0, 0, 0);
}

function shiftDay(value: number, amount: number) {
  const date = new Date(value);
  return date.setDate(date.getDate() + amount);
}

function localDateInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function weekStart(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

async function request(path = '', options?: RequestInit) {
  const response = await fetch('/api/tasks' + path, { cache: 'no-store', ...options });
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(response.status < 500 && details?.message
      ? details.message : 'Could not reach the task service. Check that the API and database are running.');
  }
  return response;
}

export default function Home() {
  const [started, setStarted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [allTasks, setAllTasks] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [matches, setMatches] = useState<Task[] | null>(null);
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!started) return;
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const term = query.trim();
        const [all, filtered] = await Promise.all([
          request().then((res) => res.json() as Promise<Task[]>),
          term ? request('?q=' + encodeURIComponent(term)).then((res) => res.json() as Promise<Task[]>) : null,
        ]);
        if (!active) return;
        setTasks(all);
        setMatches(filtered);
        setLoadError('');
      } catch (error) {
        if (active) setLoadError((error as Error).message);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    const initial = window.setTimeout(() => void refresh(), query ? 250 : 0);
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      active = false;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [query, revision, started]);

  const reminders = tasks.filter((task) => !task.completed && task.remindedFor === task.dueAt);
  const visible = query.trim() ? matches ?? [] : tasks;
  const currentDay = selected ?? midnight(new Date());
  const start = weekStart(new Date(currentDay).toISOString());
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(start, index));
  const weekly = tasks.filter((task) => weekStart(task.dueAt) === start);
  const closed = weekly.filter((task) => task.completed).length;
  const shown = searchOpen ? visible : allTasks ? weekly :
    weekly.filter((task) => midnight(new Date(task.dueAt)) === currentDay);

  async function mutate(path: string, method: string, data?: object) {
    setBusy(true);
    setActionError('');
    try {
      await request(path, {
        method,
        ...(data && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
      });
      setRevision((value) => value + 1);
      return true;
    } catch (error) {
      setActionError((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function clearForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dueAt = new Date(form.date);
    if (!Number.isFinite(dueAt.getTime())) {
      setActionError('Enter a valid date and time.');
      return;
    }
    const saved = await mutate(editing ? '/' + editing : '', editing ? 'PUT' : 'POST', {
      title: form.title,
      description: form.description,
      dueAt: dueAt.toISOString(),
      priority: form.priority || null,
    });
    if (saved) {
      setSelected(midnight(dueAt));
      sheet.current?.close();
    }
  }

  function edit(task: Task) {
    setEditing(task.id);
    setForm({
      title: task.title,
      description: task.description ?? '',
      date: localDateInput(task.dueAt),
      priority: task.priority ?? '',
    });
    setActionError('');
    sheet.current?.showModal();
  }

  if (!started) return (
    <main className="app-frame flex flex-col bg-white lg:grid lg:w-full lg:max-w-none lg:grid-cols-[1.2fr_1fr] lg:shadow-none">
      <div aria-hidden="true" className="welcome-art relative min-h-[55svh] flex-1 overflow-hidden bg-brand lg:min-h-svh">
        <span className="absolute -top-10 -right-6 size-28 rounded-full border-[18px] border-white/15" />
        <span className="zigzag absolute top-24 -left-4" />
        <span className="zigzag absolute right-0 bottom-10" />
      </div>
      <div className="flex min-h-[15rem] flex-col items-start px-6 pt-6 pb-7 sm:px-10 lg:justify-center lg:px-14">
        <h1 className="text-2xl font-bold tracking-tight lg:text-4xl">Manage What To Do</h1>
        <p className="mt-3 max-w-xs text-sm text-slate-600">Plan your tasks and keep track of what you’ve finished.</p>
        <button className="primary mt-auto w-full lg:mt-8 lg:w-auto lg:px-8" onClick={() => setStarted(true)}>Get Started</button>
      </div>
    </main>
  );

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
    setMatches(null);
  }

  function addTask() {
    setActionError('');
    setForm({ ...emptyForm, date: localDateInput(new Date(selected ?? Date.now()).toISOString()) });
    sheet.current?.showModal();
  }

  return (
    <main className="relative min-h-svh w-full bg-[#fcfcfe] px-4 pb-28 sm:px-6 lg:px-8 lg:pb-10">
      <header className="flex min-h-18 items-center justify-between gap-2 lg:mb-6 lg:min-h-24 lg:border-b lg:border-slate-200">
        {searchOpen ? <button className="icon-button" aria-label="Back to planner" onClick={closeSearch}><ArrowLeft /></button>
          : <h1 className="text-lg font-bold tracking-tight lg:text-3xl">Task Planner</h1>}
        <div className="relative flex items-center gap-1 lg:gap-4">
          {!searchOpen && <button className="primary hidden items-center gap-2 rounded-lg lg:inline-flex" onClick={addTask}>
            <Plus size={18} aria-hidden="true" /> Add task
          </button>}
          <button className="icon-button relative" aria-label={`Reminders (${reminders.length})`} aria-expanded={bellOpen}
            onClick={() => setBellOpen(!bellOpen)}>
            <Bell size={20} />
            {reminders.length > 0 && <span className="absolute top-0 right-0 rounded-full bg-brand px-1 text-xs text-white">{reminders.length}</span>}
          </button>
          {bellOpen && <section className="absolute top-full right-0 z-10 max-h-[50vh] w-64 overflow-auto border border-slate-200 bg-white p-4 shadow-lg">
            <h2 className="font-semibold">Due reminders</h2>
            {!reminders.length && <p className="mt-2 text-sm text-slate-600">No due reminders.</p>}
            <ul className="mt-2 divide-y divide-slate-100">{reminders.map((task) => <li key={task.id}>
              <Link href={`/tasks/${encodeURIComponent(task.id)}`} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-indigo-50">
                <span className="min-w-0 wrap-anywhere">
                  {task.title}<time className="block text-xs text-slate-500" dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleString()}</time>
                </span>
                <ChevronRight size={16} className="shrink-0" aria-hidden="true" />
              </Link>
            </li>)}</ul>
          </section>}
        </div>
      </header>

      <div className={searchOpen ? 'lg:mx-auto lg:max-w-3xl' : 'lg:grid lg:grid-cols-[minmax(24rem,2fr)_minmax(0,3fr)] lg:items-start lg:gap-6'}>
      {searchOpen ? (
        <label className="search-box lg:mb-5">
          <input autoFocus type="search" aria-label="Search tasks" placeholder="Search for a task" value={query}
            onChange={(event) => {
              setLoading(true);
              setMatches(null);
              setQuery(event.target.value);
            }} />
          <Search size={19} aria-hidden="true" />
        </label>
      ) : (
        <section aria-label="Week overview" className="lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:p-5">
          <button className="search-box w-full text-left text-slate-500" onClick={() => setSearchOpen(true)}>
            Search for a task <Search size={19} className="text-ink" aria-hidden="true" />
          </button>
          <div className="mt-4 flex items-center justify-between">
            <button className="icon-button" aria-label="Previous week" onClick={() => setSelected(shiftDay(currentDay, -7))}><ChevronLeft size={18} /></button>
            <p className="text-sm font-medium">{new Date(start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
            <button className="icon-button" aria-label="Next week" onClick={() => setSelected(shiftDay(currentDay, 7))}><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1" aria-label="Days of the week">
            {days.map((day) => {
              const date = new Date(day);
              const active = day === currentDay && !allTasks;
              return <button key={day} aria-pressed={active} aria-label={date.toLocaleDateString(undefined, { dateStyle: 'full' })}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${active ? 'bg-brand text-white' : 'text-slate-600 hover:bg-indigo-50'}`}
                onClick={() => { setSelected(day); setAllTasks(false); }}>
                {date.toLocaleDateString(undefined, { weekday: 'short' })}
                <span className="text-sm font-semibold">{date.getDate()}</span>
              </button>;
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="stat bg-[#eef0ff]">
              <CheckSquare size={19} className="shrink-0 text-[#3c54ce]" />
              <div className="min-w-0"><h2 className="text-xs font-medium wrap-anywhere">Task Complete</h2><p className="mt-1 text-xl font-semibold">{closed}<small className="block text-xs font-normal text-slate-600">This Week</small></p></div>
            </div>
            <div className="stat bg-[#ffe7e9]">
              <SquareX size={19} className="shrink-0 text-[#b93446]" />
              <div className="min-w-0"><h2 className="text-xs font-medium wrap-anywhere">Task Pending</h2><p className="mt-1 text-xl font-semibold">{weekly.length - closed}<small className="block text-xs font-normal text-slate-600">This Week</small></p></div>
            </div>
          </div>
          <section className="mt-7">
            <h2 className="font-semibold">Weekly Progress</h2>
            <div role="progressbar" aria-label="Weekly progress" aria-valuenow={closed} aria-valuemax={weekly.length || 1} className="mt-3 h-4 bg-[#dad8fa]">
              <div className="h-full bg-[#27388f]" style={{ width: `${weekly.length ? closed / weekly.length * 100 : 0}%` }} />
            </div>
          </section>
        </section>
      )}

      <section className="mt-7 lg:mt-0 lg:min-h-72 lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{searchOpen ? 'Search results' : allTasks ? 'Tasks This Week' :
            currentDay === midnight(new Date()) ? 'Tasks Today' : `Tasks for ${new Date(currentDay).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</h2>
          {!searchOpen && <button className="min-h-10 text-sm font-medium text-brand" onClick={() => setAllTasks(!allTasks)}>
            {allTasks ? 'Selected Day' : 'View All'}
          </button>}
        </div>
        {loadError && <p role="alert" className="my-3 text-sm text-red-700">{loadError}</p>}
        {actionError && <p role="alert" className="my-3 text-sm text-red-700">{actionError}</p>}
        {loading && !loadError && <p role="status" className="my-3 text-sm text-slate-600">Loading tasks…</p>}
        {!loading && !loadError && !shown.length && <p className="my-3 text-sm text-slate-600">{searchOpen && query.trim() ? 'No matching tasks.' : 'No tasks scheduled.'}</p>}
        <ul className="mt-1">
          {shown.map((task) => <li key={task.id} className="flex items-start gap-2 border-b border-slate-200 py-2 sm:gap-3">
            <label className="grid size-10 shrink-0 place-items-center">
              <input type="checkbox" className="size-4 accent-brand" checked={task.completed} disabled={busy}
                aria-label={`Mark ${task.title} ${task.completed ? 'open' : 'closed'}`}
                onChange={() => void mutate('/' + task.id + '/completion', 'PATCH', { completed: !task.completed })} />
            </label>
            <div className="min-w-0 flex-1 py-2 wrap-anywhere">
              <strong className={`text-sm font-medium ${task.completed ? 'line-through' : ''}`}>{task.title}</strong>
              {task.description && <p className="mt-1 text-xs whitespace-pre-wrap text-slate-600">{task.description}</p>}
              <p className="mt-1 text-xs text-slate-600"><time dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleString()}</time>
                {task.priority && <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 capitalize text-indigo-800">{task.priority.toLowerCase()}</span>}
              </p>
            </div>
            <div className="flex shrink-0 text-slate-500">
              <button className="icon-button" disabled={busy} aria-label={`Delete ${task.title}`} onClick={() => {
                if (window.confirm(`Delete “${task.title}”?`)) void mutate('/' + task.id, 'DELETE');
              }}><Trash2 size={17} /></button>
              <button className="icon-button" disabled={busy} aria-label={`Edit ${task.title}`} onClick={() => edit(task)}><Pencil size={17} /></button>
            </div>
          </li>)}
        </ul>
      </section>
      </div>

      {!searchOpen && <button className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 grid size-15 -translate-x-1/2 place-items-center rounded-full bg-brand text-white shadow-lg hover:bg-indigo-700 lg:hidden" aria-label="Add task" onClick={addTask}><Plus size={26} /></button>}

      <dialog ref={sheet} aria-labelledby="task-form-title" className="task-sheet" onClose={() => {
        clearForm();
        setActionError('');
      }} onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <form className="grid gap-4" onSubmit={save}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="task-form-title" className="text-lg font-semibold">{editing ? 'Edit Task' : 'Add New Task'}</h2>
            <button type="button" className="icon-button" disabled={busy} aria-label="Close task form" onClick={() => sheet.current?.close()}><X size={19} /></button>
          </div>
          <label className="field">Task title <span className="text-red-700" aria-hidden="true">*</span>
            <input required value={form.title} placeholder="Enter task title" onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="field">Date &amp; time <span className="text-red-700" aria-hidden="true">*</span>
            <input type="datetime-local" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </label>
          <label className="field">Priority
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              <option value="">No priority</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
            </select>
          </label>
          <label className="field">Description
            <textarea rows={3} value={form.description} placeholder="Add Description" onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
          <button className="primary w-full" disabled={busy} type="submit">{editing ? 'Save Changes' : 'Create Task'}</button>
        </form>
      </dialog>
    </main>
  );
}
