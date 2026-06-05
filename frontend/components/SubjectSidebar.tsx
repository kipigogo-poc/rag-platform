'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon, IconSpinner } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

export interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

const PRESET_COLORS = [
  '#0a2a92',
  '#5992c6',
  '#31241f',
  '#1e40af',
  '#0369a1',
  '#0f766e',
  '#b45309',
  '#be185d',
];

interface SubjectSidebarProps {
  activeSubjectId: string | null;
  onSelect: (subject: Subject) => void;
}

export function SubjectSidebar({ activeSubjectId, onSelect }: SubjectSidebarProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSubjects();
    // Mount-only load; including fetchSubjects would re-fetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showForm) inputRef.current?.focus();
  }, [showForm]);

  async function fetchSubjects() {
    setLoading(true);
    try {
      const data = await apiClient<Subject[]>('/subjects');
      setSubjects(data);
      if (data.length > 0 && !activeSubjectId) {
        onSelect(data[0]);
      }
    } catch {
      // silently fail — user sees empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const subject = await apiClient<Subject>('/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      setSubjects((prev) => [...prev, subject]);
      setNewName('');
      setShowForm(false);
      onSelect(subject);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await apiClient<Subject>(`/subjects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      });
      setSubjects((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } finally {
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient(`/subjects/${id}`, { method: 'DELETE' });
      const remaining = subjects.filter((s) => s.id !== id);
      setSubjects(remaining);
      if (activeSubjectId === id) {
        onSelect(remaining[0] ?? null!);
      }
    } catch {
      // ignore
    }
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-2 pr-6 border-r border-border min-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Subjects
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:border-danube hover:bg-danube/10 transition-colors"
          title="Add subject"
        >
          <Icon name="add" className="text-danube" size={14} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-3 space-y-3 animate-fade-in p-4 rounded-md border border-border bg-card shadow-sm">
          <Input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="AWS Practitioner"
            maxLength={80}
            disabled={creating}
          />
          <div className="flex items-center gap-1 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-transform',
                  newColor === c ? 'border-danube scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1 gap-1" disabled={creating || !newName.trim()}>
              {creating ? <IconSpinner size={12} /> : <Icon name="check" size={12} />}
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setNewName(''); }}
            >
              Never mind
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <IconSpinner size={14} /> Loading…
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
          <Icon name="menu_book" className="text-danube/40" size={32} />
          <p className="text-xs text-muted-foreground leading-relaxed">No subjects yet.<br />Hit + to add one.</p>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {subjects.map((subject) => (
            <li key={subject.id}>
              {editingId === subject.id ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(subject.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(subject.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="h-7 text-xs"
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors text-sm',
                    activeSubjectId === subject.id
                      ? 'bg-danube/15 border border-danube/30 font-medium text-danube'
                      : 'hover:bg-danube/8 text-muted-foreground hover:text-foreground border border-transparent',
                  )}
                  onClick={() => onSelect(subject)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="flex-1 truncate">{subject.name}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(subject.id);
                        setEditName(subject.name);
                      }}
                      className="p-0.5 rounded hover:bg-background/80"
                      title="Rename"
                    >
                      <Icon name="edit" size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(subject.id);
                      }}
                      className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"
                      title="Remove"
                    >
                      <Icon name="delete" size={12} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
