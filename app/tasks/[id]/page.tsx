'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type TaskDetails = {
  title: string;
  description: string | null;
  dueAt: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  completed: boolean;
};

type Result = { id: string; task: TaskDetails } | { id: string; error: string };

export default function TaskDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTask() {
      try {
        const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 404) {
          setResult({ id, error: 'This task could not be found. It may have been deleted.' });
          return;
        }
        if (!response.ok) throw new Error();
        const task: TaskDetails = await response.json();
        if (!controller.signal.aborted) setResult({ id, task });
      } catch {
        if (!controller.signal.aborted) setResult({ id, error: 'Could not load the task. Try refreshing the page.' });
      }
    }

    void loadTask();
    return () => controller.abort();
  }, [id]);

  const current = result?.id === id ? result : null;

  return (
    <main className="min-h-svh bg-[#fcfcfe] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-brand">
          <ArrowLeft size={18} aria-hidden="true" /> Task planner
        </Link>
        <article className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Task details</h1>
          {!current ? <p className="mt-4 text-sm text-slate-600" role="status">Loading task…</p>
            : 'error' in current ? <p className="mt-4 text-sm text-red-700" role="alert">{current.error}</p>
            : <>
              <h2 className="mt-5 text-xl font-semibold wrap-anywhere">{current.task.title}</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-semibold">Date &amp; time</dt>
                  <dd className="mt-1 text-slate-700"><time dateTime={current.task.dueAt}>{new Date(current.task.dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">Priority</dt>
                  <dd className="mt-1 text-slate-700">{current.task.priority ? current.task.priority[0] + current.task.priority.slice(1).toLowerCase() : 'No priority'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">Status</dt>
                  <dd className="mt-1 text-slate-700">{current.task.completed ? 'Complete' : 'Pending'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-semibold">Description</dt>
                  <dd className="mt-1 wrap-anywhere whitespace-pre-wrap text-slate-700">{current.task.description || 'No description'}</dd>
                </div>
              </dl>
            </>}
        </article>
      </div>
    </main>
  );
}
