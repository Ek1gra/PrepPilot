'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Builder from '../components/Builder';
import PracticeMode from '../components/PracticeMode';
import ScheduleView from '../components/ScheduleView';
import { ItemStates, PrepKit, QuestionCategory } from '../types/kit';
import { BookOpen, Calendar, CheckCircle2, FileJson, Layers, Loader2, LogOut, Sparkles, Upload } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const loadingStages = ['Crawling the company site…', 'Finding hiring and interview signals…', 'Extracting role requirements…', 'Generating targeted question tracks…', 'Closing coverage gaps…', 'Building flashcards and schedule…'];

type User = { id: string; email: string };

type SavedKit = { _id: string; kit: PrepKit; createdAt: string };

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [jd, setJd] = useState('');
  const [companyUrl, setCompanyUrl] = useState('https://posthog.com');
  const [days, setDays] = useState(5);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(loadingStages[0]);
  const [error, setError] = useState('');
  const [kit, setKit] = useState<PrepKit | null>(null);
  const [kitId, setKitId] = useState<string | null>(null);
  const [itemStates, setItemStates] = useState<ItemStates>({});
  const [activeTab, setActiveTab] = useState<'builder' | 'practice' | 'schedule'>('builder');
  const [savedKits, setSavedKits] = useState<SavedKit[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api('/api/auth/me').then((data) => setUser(data.user)).catch(() => undefined).finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!loading) return;
    let index = 0;
    setLoadingStep(loadingStages[0]);
    const timer = setInterval(() => {
      index = Math.min(index + 1, loadingStages.length - 1);
      setLoadingStep(loadingStages[index]);
    }, 3500);
    return () => clearInterval(timer);
  }, [loading]);

  const loadSavedKits = useCallback(async () => {
    if (!user) return;
    try { setSavedKits(await api('/api/kits')); } catch { setSavedKits([]); }
  }, [user]);

  useEffect(() => { loadSavedKits(); }, [loadSavedKits]);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    try {
      const data = await api(`/api/auth/${authMode}`, { method: 'POST', body: JSON.stringify({ email: authEmail, password: authPassword }) });
      setUser(data.user);
      setAuthPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null); setKit(null); setKitId(null); setSavedKits([]);
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(''); setKit(null);
    try {
      const data = await api('/api/kits/generate', { method: 'POST', body: JSON.stringify({ jd, companyUrl, days }) });
      setKit(data.kit); setKitId(data.id); setItemStates({}); setActiveTab('builder');
      await loadSavedKits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally { setLoading(false); }
  };

  const handleBatch = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true); setError('');
    try {
      const text = await file.text();
      const cases = JSON.parse(text);
      if (!Array.isArray(cases)) throw new Error('Batch file must contain an array of cases');
      const data = await api('/api/kits/batch', { method: 'POST', body: JSON.stringify({ cases }) });
      const first = data.kits.find((item: any) => item.status === 'ok');
      if (!first) throw new Error('No batch case completed successfully');
      setKit(first.kit); setItemStates({}); setKitId(null); setActiveTab('builder');
      setError(`${data.kits.filter((item: any) => item.status === 'failed').length} case(s) failed. Successful cases were generated and saved.`);
      await loadSavedKits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch processing failed');
    } finally { setLoading(false); event.target.value = ''; }
  };

  const updateKit = (updatedKit: PrepKit, states: ItemStates) => {
    setKit(updatedKit); setItemStates(states);
    if (!kitId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api(`/api/kits/${kitId}`, { method: 'PUT', body: JSON.stringify({ kit: updatedKit, itemStates: states }) }).catch((err) => setError(err instanceof Error ? err.message : 'Could not save changes'));
    }, 700);
  };

  const regenerate = async (section: 'company_brief' | 'category' | 'schedule', category?: QuestionCategory) => {
    if (!kitId) { setError('This batch preview is not linked to a saved kit. Generate a single kit to enable regeneration.'); return; }
    setError('');
    try {
      const data = await api(`/api/kits/${kitId}/regenerate-section`, { method: 'POST', body: JSON.stringify({ section, category }) });
      setKit(data.kit); setItemStates(data.itemStates || itemStates);
    } catch (err) { setError(err instanceof Error ? err.message : 'Regeneration failed'); }
  };

  const openSavedKit = async (id: string) => {
    try {
      const data = await api(`/api/kits/${id}`);
      setKit(data.kit); setItemStates(data.itemStates || {}); setKitId(data.id); setActiveTab('builder'); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open kit'); }
  };

  if (!authChecked) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100"><Loader2 className="h-6 w-6 animate-spin" /></main>;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-slate-100">
        <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
          <div className="mb-7 text-center"><p className="text-sm font-bold tracking-[0.25em] text-indigo-400">PREPPILOT</p><h1 className="mt-2 text-3xl font-black">Interview prep, engineered.</h1><p className="mt-2 text-sm text-slate-400">Research-driven preparation tailored to the role and company.</p></div>
          <div className="mb-5 flex rounded-xl bg-slate-950 p-1"><button onClick={() => setAuthMode('login')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Log in</button><button onClick={() => setAuthMode('register')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${authMode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Create account</button></div>
          <form onSubmit={handleAuth} className="space-y-4">
            <label className="block text-xs font-semibold text-slate-300">Email<input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm" /></label>
            <label className="block text-xs font-semibold text-slate-300">Password<input type="password" required minLength={8} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm" /></label>
            {authError && <p className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{authError}</p>}
            <button className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500">{authMode === 'login' ? 'Log in to PrepPilot' : 'Create PrepPilot account'}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col gap-5 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm font-black tracking-[0.28em] text-indigo-400">PREPPILOT</p><h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">The AI Interview Prep Kit</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Personalised research, multi-pass question banks, editable flashcards, and deterministic study schedules.</p></div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 sm:block">{user.email}</span><button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"><LogOut className="h-4 w-4" /> Log out</button></div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <form onSubmit={handleGenerate} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-400" /><h2 className="font-bold">Create a personalised kit</h2></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-300">Company website<input type="url" required value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm" placeholder="https://company.com" /></label>
              <label className="text-xs font-semibold text-slate-300">Days until interview<input type="number" required min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm" /></label>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Job description<textarea required minLength={10} rows={6} value={jd} onChange={(e) => setJd(e.target.value)} className="mt-1 w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm" placeholder="Paste the full job description here…" /></label>
            <button disabled={loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? <><Loader2 className="h-5 w-5 animate-spin" />{loadingStep}</> : <><Sparkles className="h-5 w-5" />Generate Prep Kit</>}</button>
          </form>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between"><h2 className="font-bold">My kits</h2><label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300" title="Process batch JSON"><Upload className="h-4 w-4" /><input type="file" accept=".json,application/json" onChange={handleBatch} className="hidden" /></label></div>
            <p className="mt-1 text-xs text-slate-500">Open saved work or process multiple cases.</p>
            <div className="mt-4 space-y-2">{savedKits.length ? savedKits.map((saved) => <button key={saved._id} onClick={() => openSavedKit(saved._id)} className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-left hover:border-indigo-500/50"><p className="truncate text-sm font-semibold">{saved.kit?.source?.company || 'Unknown company'}</p><p className="mt-1 text-xs text-slate-500">{saved.kit?.role?.title || saved.kit?.source?.role || 'Untitled role'}</p></button>) : <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500"><FileJson className="mx-auto mb-2 h-5 w-5" />No saved kits yet.</div>}</div>
          </aside>
        </section>

        {error && <div className="flex items-start gap-2 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

        {kit && <section className="space-y-5">
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2" aria-label="Kit sections">
            <button onClick={() => setActiveTab('builder')} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'builder' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-900'}`}><Layers className="h-4 w-4" />Builder</button>
            <button onClick={() => setActiveTab('practice')} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'practice' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-900'}`}><BookOpen className="h-4 w-4" />Practice</button>
            <button onClick={() => setActiveTab('schedule')} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'schedule' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-900'}`}><Calendar className="h-4 w-4" />Schedule</button>
          </nav>
          {activeTab === 'builder' && <Builder kit={kit} itemStates={itemStates} onUpdateKit={updateKit} onRegenerateSection={regenerate} />}
          {activeTab === 'practice' && <PracticeMode flashcards={kit.flashcards} />}
          {activeTab === 'schedule' && <ScheduleView schedule={kit.schedule} questions={kit.questions} />}
        </section>}
      </div>
    </main>
  );
}
