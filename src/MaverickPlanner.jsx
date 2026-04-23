import { useState, useEffect, useMemo } from 'react';
import {
  Zap, Grid3x3, Feather, Inbox, Plus, Circle, CheckCircle2,
  Sparkles, ChevronLeft, X, Trash2, Briefcase, Heart, Home,
  Code, Flame, BookOpen, ArrowRight, Edit3, Check,
  Calendar, Sunrise, Moon, Target, Search, Settings, Download,
  Upload, Archive, Flame as FlameIcon, TrendingUp, Clock,
  RefreshCw, HelpCircle, Brain, Loader
} from 'lucide-react';

// ============ DOMAINS ============
const DOMAINS = [
  { id: 'work',     label: 'Work',     sub: 'Special Assets', icon: Briefcase, color: '#2563eb', soft: '#dbeafe', text: '#1e40af' },
  { id: 'ministry', label: 'Ministry', sub: 'Section 6 Youth', icon: Heart,    color: '#059669', soft: '#d1fae5', text: '#065f46' },
  { id: 'family',   label: 'Family',   sub: 'Home life',       icon: Home,     color: '#e11d48', soft: '#ffe4e6', text: '#9f1239' },
  { id: 'projects', label: 'Projects', sub: 'Sims & Apps',     icon: Code,     color: '#7c3aed', soft: '#ede9fe', text: '#5b21b6' },
  { id: 'faith',    label: 'Faith',    sub: 'KJV study',       icon: BookOpen, color: '#d97706', soft: '#fef3c7', text: '#92400e' },
  { id: 'home',     label: 'Home',     sub: 'Tundra & grill',  icon: Flame,    color: '#ea580c', soft: '#ffedd5', text: '#9a3412' },
];

const getDomain = (id) => DOMAINS.find(d => d.id === id) || DOMAINS[0];

// ============ JOURNAL PROMPTS ============
const PROMPTS = [
  "Where did I see God's hand today?",
  "What's the one thing I'm proud of from today?",
  "What drained me today, and why?",
  "What's pressing on my mind right now?",
  "What did I learn today — about myself, my work, or others?",
  "Who did I serve well today? Who did I fall short with?",
  "What am I avoiding, and what's the cost of avoiding it?",
  "What would make tomorrow a win?",
  "What scripture has been sitting with me?",
  "What's a small thing I'm grateful for right now?",
  "Where am I growing? Where am I stagnating?",
  "What did I want to do today that I didn't?",
  "What made me laugh today?",
  "What conversation from today do I want to remember?",
  "What's something I need to forgive — myself or someone else?",
];

// ============ DATE HELPERS ============
const today = () => new Date().toISOString().slice(0, 10);
const todayDate = () => new Date();

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const formatDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};
const formatDateShort = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const formatDateMedium = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Week is Sunday-start (church week)
const getSundayOf = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};
const getWeekDates = (sundayIso) => {
  return Array.from({ length: 7 }, (_, i) => addDays(sundayIso, i));
};
const getFridayOf = (sundayIso) => addDays(sundayIso, 5);

// Deterministic prompt
const getPromptForDate = (iso) => {
  const hash = iso.split('-').reduce((a, s) => a + parseInt(s, 10), 0);
  return PROMPTS[hash % PROMPTS.length];
};

// Habit streak calculation
const calcStreak = (habit) => {
  const todayStr = today();
  let streak = 0;
  let cursor = todayStr;
  // If today not done, start from yesterday (don't break streak before end of day)
  if (!habit.dates[cursor]) cursor = addDays(cursor, -1);
  while (habit.dates[cursor]) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

// ============ NL PARSER ============
// Parses strings like: "finish brisket rub tomorrow #home ⭐ every sunday"
// Returns { text, domain, dueDate, top3, recurrence }

const DOMAIN_ALIASES = {
  work: 'work', w: 'work',
  ministry: 'ministry', m: 'ministry', min: 'ministry',
  family: 'family', fam: 'family',
  projects: 'projects', p: 'projects', proj: 'projects', project: 'projects',
  faith: 'faith', fi: 'faith',
  home: 'home', h: 'home',
};

const DAY_NAMES = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const isoFromDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const nextDayOfWeek = (targetDay, fromIso, forceNext = false) => {
  const d = new Date(fromIso + 'T00:00:00');
  const currentDay = d.getDay();
  let diff = targetDay - currentDay;
  if (diff < 0 || (diff === 0 && forceNext)) diff += 7;
  if (diff === 0 && !forceNext) return fromIso;
  d.setDate(d.getDate() + diff);
  return isoFromDate(d);
};

// Tries to parse a date phrase. Returns ISO string or null.
const parseDatePhrase = (phrase, todayIso) => {
  const p = phrase.toLowerCase().trim();
  if (!p) return null;

  if (p === 'today') return todayIso;
  if (p === 'tomorrow' || p === 'tmrw' || p === 'tmr') return addDays(todayIso, 1);
  if (p === 'yesterday') return addDays(todayIso, -1);

  // "next mon", "next friday"
  const nextMatch = p.match(/^next\s+(\w+)$/);
  if (nextMatch && DAY_NAMES[nextMatch[1]] !== undefined) {
    return nextDayOfWeek(DAY_NAMES[nextMatch[1]], todayIso, true);
  }

  // Bare day: "mon", "friday" - next occurrence (including today if match)
  if (DAY_NAMES[p] !== undefined) {
    return nextDayOfWeek(DAY_NAMES[p], todayIso, false);
  }

  // "+1d", "+2w", "+3m"
  const relMatch = p.match(/^\+(\d+)\s*(d|day|days|w|wk|week|weeks|m|mo|month|months)$/);
  if (relMatch) {
    const n = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    if (unit.startsWith('d')) return addDays(todayIso, n);
    if (unit.startsWith('w')) return addDays(todayIso, n * 7);
    if (unit.startsWith('m')) {
      const d = new Date(todayIso + 'T00:00:00');
      d.setMonth(d.getMonth() + n);
      return isoFromDate(d);
    }
  }

  // "apr 29", "april 29"
  const monthDayMatch = p.match(/^(\w+)\s+(\d{1,2})$/);
  if (monthDayMatch) {
    const mn = monthDayMatch[1];
    if (MONTH_NAMES[mn] !== undefined) {
      const day = parseInt(monthDayMatch[2], 10);
      const d = new Date(todayIso + 'T00:00:00');
      d.setMonth(MONTH_NAMES[mn]);
      d.setDate(day);
      // If the resulting date is in the past this year, roll to next year
      const todayDate = new Date(todayIso + 'T00:00:00');
      if (d < todayDate) d.setFullYear(d.getFullYear() + 1);
      return isoFromDate(d);
    }
  }

  // "4/29", "4/29/26"
  const slashMatch = p.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    let year = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date(todayIso + 'T00:00:00').getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, m, day);
    // Roll forward if past and no year specified
    if (!slashMatch[3] && d < new Date(todayIso + 'T00:00:00')) {
      d.setFullYear(d.getFullYear() + 1);
    }
    return isoFromDate(d);
  }

  // ISO "2026-04-29"
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;

  return null;
};

// Parse "every X" recurrence. Returns rule object or null.
// Rules: { type: 'daily'|'weekdays'|'weekly'|'monthly'|'everyN', dayOfWeek?, n?, unit? }
const parseRecurrence = (phrase) => {
  const p = phrase.toLowerCase().trim();
  if (!p) return null;

  if (p === 'daily' || p === 'day') return { type: 'daily' };
  if (p === 'weekday' || p === 'weekdays') return { type: 'weekdays' };
  if (p === 'week' || p === 'weekly') return { type: 'weekly' };
  if (p === 'month' || p === 'monthly') return { type: 'monthly' };

  // "every 2 weeks", "every 3 days"
  const nMatch = p.match(/^(\d+)\s+(d|day|days|w|wk|week|weeks|m|mo|month|months)$/);
  if (nMatch) {
    const n = parseInt(nMatch[1], 10);
    const unit = nMatch[2].startsWith('d') ? 'days' : nMatch[2].startsWith('w') ? 'weeks' : 'months';
    return { type: 'everyN', n, unit };
  }

  // "every monday"
  if (DAY_NAMES[p] !== undefined) {
    return { type: 'weekly', dayOfWeek: DAY_NAMES[p] };
  }

  return null;
};

// Given a recurrence rule and a completed-on date, return the next due date ISO.
const nextRecurrenceDate = (rule, fromIso) => {
  if (!rule) return null;
  const from = new Date(fromIso + 'T00:00:00');

  switch (rule.type) {
    case 'daily':
      return addDays(fromIso, 1);
    case 'weekdays': {
      let d = addDays(fromIso, 1);
      let day = new Date(d + 'T00:00:00').getDay();
      while (day === 0 || day === 6) {
        d = addDays(d, 1);
        day = new Date(d + 'T00:00:00').getDay();
      }
      return d;
    }
    case 'weekly':
      if (rule.dayOfWeek !== undefined) {
        return nextDayOfWeek(rule.dayOfWeek, fromIso, true);
      }
      return addDays(fromIso, 7);
    case 'monthly': {
      const d = new Date(fromIso + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return isoFromDate(d);
    }
    case 'everyN': {
      if (rule.unit === 'days') return addDays(fromIso, rule.n);
      if (rule.unit === 'weeks') return addDays(fromIso, rule.n * 7);
      if (rule.unit === 'months') {
        const d = new Date(fromIso + 'T00:00:00');
        d.setMonth(d.getMonth() + rule.n);
        return isoFromDate(d);
      }
      return null;
    }
    default:
      return null;
  }
};

const describeRecurrence = (rule) => {
  if (!rule) return null;
  switch (rule.type) {
    case 'daily': return 'Daily';
    case 'weekdays': return 'Weekdays';
    case 'weekly':
      if (rule.dayOfWeek !== undefined) {
        const dayName = Object.keys(DAY_NAMES).find(k => DAY_NAMES[k] === rule.dayOfWeek && k.length === 3);
        return `Every ${dayName ? dayName.charAt(0).toUpperCase() + dayName.slice(1) : 'week'}`;
      }
      return 'Weekly';
    case 'monthly': return 'Monthly';
    case 'everyN': return `Every ${rule.n} ${rule.unit}`;
    default: return null;
  }
};

// MAIN PARSER: takes raw input, returns structured task data
const parseTaskInput = (raw, todayIso) => {
  let input = raw;
  const result = {
    text: '',
    domain: null,
    dueDate: null,
    top3: false,
    recurrence: null,
    parsed: { domainToken: null, dateToken: null, recurrenceToken: null, top3Token: null },
  };

  // 1. Extract top3 markers: ⭐, !, *
  const top3Regex = /(^|\s)(⭐|!|\*)(\s|$)/;
  if (top3Regex.test(input)) {
    result.top3 = true;
    result.parsed.top3Token = input.match(top3Regex)[2];
    input = input.replace(top3Regex, ' ').trim();
  }

  // 2. Extract recurrence: "every X"
  const recurMatch = input.match(/\bevery\s+([^#⭐!*]+?)(?=\s+#|\s+⭐|\s+!|\s+\*|$)/i);
  if (recurMatch) {
    const rule = parseRecurrence(recurMatch[1].trim());
    if (rule) {
      result.recurrence = rule;
      result.parsed.recurrenceToken = recurMatch[0].trim();
      input = input.replace(recurMatch[0], ' ').trim();
    }
  }

  // 3. Extract domain tag: #foo
  const domainMatch = input.match(/#(\w+)/);
  if (domainMatch && DOMAIN_ALIASES[domainMatch[1].toLowerCase()]) {
    result.domain = DOMAIN_ALIASES[domainMatch[1].toLowerCase()];
    result.parsed.domainToken = domainMatch[0];
    input = input.replace(domainMatch[0], ' ').trim();
  }

  // 4. Extract date phrase - try progressively longer trailing phrases
  // Split into words, try matching last 1, 2, 3 words as date
  const words = input.split(/\s+/).filter(Boolean);
  for (let take = Math.min(3, words.length); take >= 1; take--) {
    const phrase = words.slice(words.length - take).join(' ');
    const parsed = parseDatePhrase(phrase, todayIso);
    if (parsed) {
      result.dueDate = parsed;
      result.parsed.dateToken = phrase;
      input = words.slice(0, words.length - take).join(' ').trim();
      break;
    }
  }
  // Also try first words (in case user typed "tomorrow finish brisket")
  if (!result.dueDate) {
    const wordsNow = input.split(/\s+/).filter(Boolean);
    for (let take = Math.min(3, wordsNow.length); take >= 1; take--) {
      const phrase = wordsNow.slice(0, take).join(' ');
      const parsed = parseDatePhrase(phrase, todayIso);
      if (parsed) {
        result.dueDate = parsed;
        result.parsed.dateToken = phrase;
        input = wordsNow.slice(take).join(' ').trim();
        break;
      }
    }
  }

  // 5. Clean up remaining text = task text
  result.text = input.replace(/\s+/g, ' ').trim();

  // Defaults
  if (!result.domain) result.domain = 'work';
  if (!result.dueDate) result.dueDate = todayIso;

  return result;
};

// ============ STORAGE ============
const STORAGE_KEY = 'maverick-planner-v3';

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};
const saveState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
};

// ============ INITIAL STATE ============
const INITIAL_STATE = {
  version: 3,
  tasks: [
    { id: 1, text: 'Draft AI GM personality logic for Ground Rules', domain: 'projects', done: false, top3: true, dueDate: today(), createdAt: Date.now() },
    { id: 2, text: 'Send ReKindle Fall Trip reminder to parents', domain: 'ministry', done: false, top3: true, dueDate: today(), createdAt: Date.now() },
    { id: 3, text: 'Review 3 loan files in Special Assets queue', domain: 'work', done: false, top3: true, dueDate: today(), createdAt: Date.now() },
    { id: 4, text: 'KJV reading — Proverbs 23', domain: 'faith', done: false, top3: false, dueDate: today(), createdAt: Date.now(), recurrence: { type: 'weekdays' } },
    { id: 5, text: 'Schedule Tundra oil change', domain: 'home', done: false, top3: false, dueDate: addDays(today(), 2), createdAt: Date.now() },
  ],
  inbox: [],
  journal: {}, // date -> { text, tags: [domainId] }
  habits: [
    { id: 'h1', label: 'Scripture', dates: {} },
    { id: 'h2', label: 'Deep work', dates: {} },
    { id: 'h3', label: 'Family time', dates: {} },
    { id: 'h4', label: 'Movement', dates: {} },
  ],
  notes: {},
  goals: {}, // domain-id -> [{ id, text, createdAt }]
  weeks: {}, // sunday-iso -> { bigRocks, scripture, planNotes, worked, didntWork, nextFocus, score, aiInsights?: { generatedAt, observations: [] } }
};

// Migration from v1
const migrateV1 = () => {
  try {
    const v1Raw = localStorage.getItem('maverick-planner-v1');
    if (!v1Raw) return null;
    const v1 = JSON.parse(v1Raw);
    const migrated = { ...INITIAL_STATE };
    migrated.tasks = (v1.tasks || []).map(t => ({
      id: t.id,
      text: t.text,
      domain: t.domain,
      done: t.done,
      top3: t.top3,
      dueDate: t.date || today(),
      createdAt: Date.now()
    }));
    migrated.inbox = v1.inbox || [];
    migrated.habits = v1.habits || INITIAL_STATE.habits;
    migrated.notes = v1.notes || {};
    const oldJournal = v1.journal || {};
    migrated.journal = {};
    Object.keys(oldJournal).forEach(date => {
      const val = oldJournal[date];
      migrated.journal[date] = typeof val === 'string' ? { text: val, tags: [] } : val;
    });
    return migrated;
  } catch { return null; }
};

// Migration from v2
const migrateV2 = () => {
  try {
    const v2Raw = localStorage.getItem('maverick-planner-v2');
    if (!v2Raw) return null;
    const v2 = JSON.parse(v2Raw);
    // v2 is already close to v3 shape — just bump version and ensure recurrence field exists
    return {
      ...INITIAL_STATE,
      ...v2,
      version: 3,
      tasks: (v2.tasks || []).map(t => ({ ...t, recurrence: t.recurrence || null })),
    };
  } catch { return null; }
};

// ============ MAIN APP ============
export default function MaverickPlanner() {
  const [state, setState] = useState(() => {
    return loadState() || migrateV2() || migrateV1() || INITIAL_STATE;
  });
  const [view, setView] = useState('today');
  const [activeDomain, setActiveDomain] = useState(null);
  const [showInbox, setShowInbox] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { saveState(state); }, [state]);

  // ===== Task actions =====
  const toggleTask = (id) => {
    setState(s => {
      const task = s.tasks.find(t => t.id === id);
      if (!task) return s;
      const wasDone = task.done;
      const updated = s.tasks.map(t => t.id === id
        ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined }
        : t
      );
      // If we just completed a recurring task, spawn the next instance
      if (!wasDone && task.recurrence) {
        const nextDate = nextRecurrenceDate(task.recurrence, task.dueDate);
        if (nextDate) {
          updated.push({
            id: Date.now() + 1,
            text: task.text,
            domain: task.domain,
            done: false,
            top3: task.top3,
            dueDate: nextDate,
            createdAt: Date.now(),
            recurrence: task.recurrence,
            parentId: task.parentId || task.id,
          });
        }
      }
      return { ...s, tasks: updated };
    });
  };
  const toggleTop3 = (id) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, top3: !t.top3 } : t) }));
  };
  const deleteTask = (id) => {
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
  };
  // Unified add — accepts parsed NL result or individual args
  const addTask = (opts) => {
    const { text, domain = 'work', dueDate = today(), top3 = false, recurrence = null } = opts;
    if (!text || !text.trim()) return;
    setState(s => ({
      ...s,
      tasks: [...s.tasks, {
        id: Date.now(),
        text: text.trim(),
        domain,
        done: false,
        top3,
        dueDate,
        createdAt: Date.now(),
        recurrence,
      }]
    }));
  };
  const rescheduleTask = (id, dueDate) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, dueDate } : t) }));
  };
  const clearRecurrence = (id) => {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, recurrence: null } : t) }));
  };

  // ===== Inbox =====
  const addInbox = (text) => {
    if (!text.trim()) return;
    setState(s => ({ ...s, inbox: [{ id: Date.now(), text: text.trim(), captured: Date.now() }, ...s.inbox] }));
  };
  const deleteInbox = (id) => {
    setState(s => ({ ...s, inbox: s.inbox.filter(i => i.id !== id) }));
  };
  const promoteInbox = (id, domain) => {
    const item = state.inbox.find(i => i.id === id);
    if (!item) return;
    setState(s => ({
      ...s,
      inbox: s.inbox.filter(i => i.id !== id),
      tasks: [...s.tasks, { id: Date.now(), text: item.text, domain, done: false, top3: false, dueDate: today(), createdAt: Date.now(), recurrence: null }]
    }));
  };

  // ===== Journal =====
  const saveJournal = (date, text, tags) => {
    setState(s => ({ ...s, journal: { ...s.journal, [date]: { text, tags: tags || [] } } }));
  };

  // ===== Habits =====
  const toggleHabit = (habitId, date) => {
    setState(s => ({
      ...s,
      habits: s.habits.map(h =>
        h.id === habitId ? { ...h, dates: { ...h.dates, [date]: !h.dates[date] } } : h
      )
    }));
  };
  const addHabit = (label) => {
    if (!label.trim()) return;
    setState(s => ({ ...s, habits: [...s.habits, { id: `h${Date.now()}`, label: label.trim(), dates: {} }] }));
  };
  const deleteHabit = (habitId) => {
    setState(s => ({ ...s, habits: s.habits.filter(h => h.id !== habitId) }));
  };
  const renameHabit = (habitId, label) => {
    if (!label.trim()) return;
    setState(s => ({ ...s, habits: s.habits.map(h => h.id === habitId ? { ...h, label: label.trim() } : h) }));
  };

  // ===== Notes =====
  const saveNote = (domainId, text) => {
    setState(s => ({ ...s, notes: { ...s.notes, [domainId]: text } }));
  };

  // ===== Goals =====
  const addGoal = (domainId, text) => {
    if (!text.trim()) return;
    setState(s => {
      const existing = s.goals[domainId] || [];
      if (existing.length >= 3) return s;
      return {
        ...s,
        goals: {
          ...s.goals,
          [domainId]: [...existing, { id: Date.now(), text: text.trim(), createdAt: Date.now() }]
        }
      };
    });
  };
  const deleteGoal = (domainId, goalId) => {
    setState(s => ({
      ...s,
      goals: { ...s.goals, [domainId]: (s.goals[domainId] || []).filter(g => g.id !== goalId) }
    }));
  };
  const editGoal = (domainId, goalId, text) => {
    setState(s => ({
      ...s,
      goals: {
        ...s.goals,
        [domainId]: (s.goals[domainId] || []).map(g => g.id === goalId ? { ...g, text } : g)
      }
    }));
  };

  // ===== Week (Sunday Plan / Friday Reflect) =====
  const updateWeek = (sundayIso, patch) => {
    setState(s => ({
      ...s,
      weeks: {
        ...s.weeks,
        [sundayIso]: { ...(s.weeks[sundayIso] || {}), ...patch }
      }
    }));
  };
  const addBigRock = (sundayIso, rock) => {
    setState(s => {
      const week = s.weeks[sundayIso] || {};
      const rocks = week.bigRocks || [];
      if (rocks.length >= 3) return s;
      return {
        ...s,
        weeks: {
          ...s.weeks,
          [sundayIso]: { ...week, bigRocks: [...rocks, { id: Date.now(), ...rock, done: false }] }
        }
      };
    });
  };
  const toggleBigRock = (sundayIso, rockId) => {
    setState(s => {
      const week = s.weeks[sundayIso] || {};
      const rocks = (week.bigRocks || []).map(r => r.id === rockId ? { ...r, done: !r.done } : r);
      return { ...s, weeks: { ...s.weeks, [sundayIso]: { ...week, bigRocks: rocks } } };
    });
  };
  const deleteBigRock = (sundayIso, rockId) => {
    setState(s => {
      const week = s.weeks[sundayIso] || {};
      const rocks = (week.bigRocks || []).filter(r => r.id !== rockId);
      return { ...s, weeks: { ...s.weeks, [sundayIso]: { ...week, bigRocks: rocks } } };
    });
  };
  const saveAIInsights = (sundayIso, insights) => {
    setState(s => ({
      ...s,
      weeks: {
        ...s.weeks,
        [sundayIso]: {
          ...(s.weeks[sundayIso] || {}),
          aiInsights: { generatedAt: Date.now(), observations: insights }
        }
      }
    }));
  };

  // ===== Export / Import =====
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maverick-planner-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = (fileContent) => {
    try {
      const parsed = JSON.parse(fileContent);
      if (!parsed.tasks || !parsed.habits) throw new Error('Invalid');
      setState(parsed);
      return true;
    } catch { return false; }
  };
  const resetData = () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      setState(INITIAL_STATE);
    }
  };

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #faf7f2 0%, #f5efe6 100%)',
      fontFamily: "'Lora', Georgia, serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Lora:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Lora', Georgia, serif; }
        .paper-texture {
          background-image:
            radial-gradient(circle at 20% 50%, rgba(139, 90, 43, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(180, 83, 9, 0.03) 0%, transparent 50%);
        }
      `}</style>

      <div className="max-w-2xl mx-auto min-h-screen paper-texture" style={{ paddingBottom: '96px' }}>
        {/* Header */}
        <header className="px-6 pt-8 pb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#1c1917' }}>
                <Sparkles size={14} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <div className="font-display text-xl font-bold tracking-tight" style={{ color: '#1c1917' }}>Maverick</div>
                <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#78716c' }}>Planner · v2</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105"
                style={{ background: '#fff', border: '1px solid #e7e5e4', color: '#57534e' }}
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => setShowInbox(true)}
                className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105"
                style={{ background: '#1c1917', color: '#fbbf24' }}
              >
                <Inbox size={16} />
                {state.inbox.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#f59e0b', color: '#1c1917' }}>
                    {state.inbox.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="px-6">
          {view === 'today' && !activeDomain && (
            <TodayView
              state={state}
              onToggleTask={toggleTask}
              onToggleTop3={toggleTop3}
              onDeleteTask={deleteTask}
              onRescheduleTask={rescheduleTask}
              onToggleHabit={toggleHabit}
              onAddHabit={addHabit}
              onDeleteHabit={deleteHabit}
              onRenameHabit={renameHabit}
              onOpenJournal={() => setView('journal')}
              onAddTask={() => setShowAddTask(true)}
              onOpenDomain={(d) => { setActiveDomain(d); setView('domains'); }}
              onGoTo={setView}
            />
          )}
          {view === 'plan' && (
            <PlanView
              state={state}
              onAddBigRock={addBigRock}
              onToggleBigRock={toggleBigRock}
              onDeleteBigRock={deleteBigRock}
              onUpdateWeek={updateWeek}
            />
          )}
          {view === 'reflect' && (
            <ReflectView
              state={state}
              onUpdateWeek={updateWeek}
              onToggleBigRock={toggleBigRock}
              onSaveAIInsights={saveAIInsights}
            />
          )}
          {view === 'domains' && !activeDomain && (
            <DomainsView state={state} onOpenDomain={(d) => setActiveDomain(d)} />
          )}
          {view === 'domains' && activeDomain && (
            <DomainDetailView
              domain={activeDomain}
              state={state}
              onBack={() => setActiveDomain(null)}
              onToggleTask={toggleTask}
              onToggleTop3={toggleTop3}
              onDeleteTask={deleteTask}
              onRescheduleTask={rescheduleTask}
              onAddTask={(text, dueDate) => addTask({ text, domain: activeDomain, dueDate })}
              onSaveNote={(text) => saveNote(activeDomain, text)}
              onAddGoal={(text) => addGoal(activeDomain, text)}
              onDeleteGoal={(id) => deleteGoal(activeDomain, id)}
              onEditGoal={(id, text) => editGoal(activeDomain, id, text)}
            />
          )}
          {view === 'journal' && (
            <JournalView state={state} onSave={saveJournal} />
          )}
          {view === 'archive' && (
            <ArchiveView state={state} onToggleTask={toggleTask} onDeleteTask={deleteTask} />
          )}
        </main>

        {/* Bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none">
          <div className="flex items-center gap-1 p-1.5 rounded-full pointer-events-auto shadow-2xl mb-4 overflow-x-auto max-w-[95vw]" style={{
            background: '#1c1917',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)'
          }}>
            {[
              { id: 'today', label: 'Today', icon: Zap },
              { id: 'plan', label: 'Plan', icon: Sunrise },
              { id: 'reflect', label: 'Reflect', icon: Moon },
              { id: 'domains', label: 'Domains', icon: Grid3x3 },
              { id: 'journal', label: 'Journal', icon: Feather },
              { id: 'archive', label: 'Archive', icon: Archive },
            ].map(t => {
              const Icon = t.icon;
              const isActive = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setView(t.id); setActiveDomain(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all flex-shrink-0"
                  style={{
                    background: isActive ? '#f59e0b' : 'transparent',
                    color: isActive ? '#1c1917' : '#a8a29e'
                  }}
                >
                  <Icon size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {showInbox && (
          <InboxModal
            state={state} onClose={() => setShowInbox(false)}
            onAdd={addInbox} onDelete={deleteInbox} onPromote={promoteInbox}
          />
        )}
        {showAddTask && (
          <AddTaskModal onClose={() => setShowAddTask(false)} onAdd={(opts) => { addTask(opts); setShowAddTask(false); }} />
        )}
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onExport={exportData}
            onImport={importData}
            onReset={resetData}
            state={state}
          />
        )}
      </div>
    </div>
  );
}

// ============ TODAY VIEW ============
function TodayView({ state, onToggleTask, onToggleTop3, onDeleteTask, onRescheduleTask, onToggleHabit, onAddHabit, onDeleteHabit, onRenameHabit, onOpenJournal, onAddTask, onOpenDomain, onGoTo }) {
  const todayStr = today();
  const sundayStr = getSundayOf(todayStr);
  const week = state.weeks[sundayStr] || {};
  const bigRocks = week.bigRocks || [];

  // Tasks due today or overdue (not done)
  const dueOrOverdue = state.tasks.filter(t => !t.done && t.dueDate <= todayStr);
  const top3 = dueOrOverdue.filter(t => t.top3);
  const other = dueOrOverdue.filter(t => !t.top3);
  const overdueCount = dueOrOverdue.filter(t => t.dueDate < todayStr).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const hasJournalToday = !!state.journal[todayStr]?.text;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <div className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: '#a8a29e' }}>
          {formatDate(todayStr)}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-tight" style={{ color: '#1c1917' }}>
          {greeting}, <span style={{ fontStyle: 'italic', color: '#92400e' }}>Michael.</span>
        </h1>
      </div>

      {/* Week's Big Rocks banner */}
      {bigRocks.length > 0 ? (
        <button
          onClick={() => onGoTo('plan')}
          className="w-full p-4 rounded-lg text-left transition-all hover:shadow-md"
          style={{
            background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
            border: '1px solid #44403c'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#fbbf24' }}>
              This Week's Big Rocks
            </div>
            <Target size={14} style={{ color: '#fbbf24' }} />
          </div>
          <div className="space-y-1.5">
            {bigRocks.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                {r.done
                  ? <CheckCircle2 size={12} style={{ color: '#10b981' }} />
                  : <Circle size={12} style={{ color: '#78716c' }} />
                }
                <span className={`text-sm flex-1 ${r.done ? 'line-through opacity-60' : ''}`} style={{ color: '#f5f5f4' }}>
                  {r.text}
                </span>
              </div>
            ))}
          </div>
        </button>
      ) : (
        <button
          onClick={() => onGoTo('plan')}
          className="w-full p-4 rounded-lg text-left"
          style={{ background: '#fff', border: '1px dashed #e7e5e4' }}
        >
          <div className="flex items-center gap-2">
            <Sunrise size={16} style={{ color: '#92400e' }} />
            <div className="flex-1">
              <div className="text-sm font-bold" style={{ color: '#1c1917' }}>Plan your week</div>
              <div className="text-xs" style={{ color: '#78716c' }}>Set 3 big rocks for the week of {formatDateShort(sundayStr)}</div>
            </div>
            <ArrowRight size={14} style={{ color: '#92400e' }} />
          </div>
        </button>
      )}

      {/* Top 3 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#57534e' }}>
            Today's Top 3
          </h2>
          {overdueCount > 0 && (
            <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#b91c1c' }}>
              <Clock size={10} /> {overdueCount} overdue
            </span>
          )}
        </div>
        {top3.length === 0 ? (
          <div className="p-5 rounded-lg text-center" style={{ background: '#fef3c7', border: '1px dashed #fcd34d' }}>
            <p className="text-sm" style={{ color: '#78716c' }}>Star up to 3 tasks below to focus</p>
          </div>
        ) : (
          <div className="space-y-2">
            {top3.map(t => (
              <TaskCard key={t.id} task={t} starred todayStr={todayStr}
                onToggle={() => onToggleTask(t.id)}
                onToggleTop3={() => onToggleTop3(t.id)}
                onDelete={() => onDeleteTask(t.id)}
                onReschedule={(d) => onRescheduleTask(t.id, d)}
              />
            ))}
          </div>
        )}
      </section>

      {other.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
            Also Due
          </h2>
          <div className="space-y-2">
            {other.map(t => (
              <TaskCard key={t.id} task={t} todayStr={todayStr}
                onToggle={() => onToggleTask(t.id)}
                onToggleTop3={() => onToggleTop3(t.id)}
                onDelete={() => onDeleteTask(t.id)}
                onReschedule={(d) => onRescheduleTask(t.id, d)}
              />
            ))}
          </div>
        </section>
      )}

      <button
        onClick={onAddTask}
        className="w-full p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:opacity-80"
        style={{ background: '#1c1917', color: '#fbbf24' }}
      >
        <Plus size={14} /> Add task
      </button>

      {/* Habits */}
      <HabitsSection
        habits={state.habits} todayStr={todayStr}
        onToggle={onToggleHabit} onAdd={onAddHabit} onDelete={onDeleteHabit} onRename={onRenameHabit}
      />

      {/* Journal prompt card */}
      <button
        onClick={onOpenJournal}
        className="w-full p-5 rounded-lg text-left transition-all hover:shadow-md"
        style={{
          background: hasJournalToday ? '#fef3c7' : '#fffbeb',
          border: `1px solid ${hasJournalToday ? '#fcd34d' : '#fde68a'}`
        }}
      >
        <div className="flex items-start gap-3">
          <Feather size={18} style={{ color: '#92400e', marginTop: '2px' }} />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: '#92400e' }}>
              {hasJournalToday ? "Today's Journal · Written" : "Today's Journal"}
            </div>
            <p className="font-display italic text-base leading-snug" style={{ color: '#1c1917' }}>
              "{getPromptForDate(todayStr)}"
            </p>
          </div>
          <ArrowRight size={16} style={{ color: '#92400e' }} />
        </div>
      </button>

      {/* Domain quick jump */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
          Jump to a Domain
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {DOMAINS.map(d => {
            const count = state.tasks.filter(t => t.domain === d.id && !t.done).length;
            const Icon = d.icon;
            return (
              <button key={d.id} onClick={() => onOpenDomain(d.id)}
                className="p-3 rounded-lg text-left transition-all hover:shadow-md"
                style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center mb-1.5" style={{ background: d.color }}>
                  <Icon size={13} color="#fff" />
                </div>
                <div className="text-xs font-bold" style={{ color: '#1c1917' }}>{d.label}</div>
                <div className="text-[10px]" style={{ color: '#78716c' }}>{count} open</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============ TASK CARD ============
function TaskCard({ task, starred, todayStr, onToggle, onToggleTop3, onDelete, onReschedule }) {
  const d = getDomain(task.domain);
  const [showReschedule, setShowReschedule] = useState(false);
  const isOverdue = !task.done && task.dueDate < todayStr;
  const isFuture = task.dueDate > todayStr;

  return (
    <div className="group p-3 rounded-lg flex items-center gap-3 transition-all relative" style={{
      background: task.done ? '#f5f5f4' : '#fff',
      border: `1px solid ${starred ? d.color + '40' : '#e7e5e4'}`,
      borderLeft: starred ? `3px solid ${d.color}` : `1px solid #e7e5e4`,
    }}>
      <button onClick={onToggle} className="flex-shrink-0">
        {task.done
          ? <CheckCircle2 size={18} style={{ color: '#059669' }} />
          : <Circle size={18} style={{ color: '#a8a29e' }} />
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${task.done ? 'line-through' : ''}`} style={{ color: task.done ? '#a8a29e' : '#1c1917' }}>
          {task.text}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }}></div>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: d.text }}>{d.label}</span>
          </div>
          {task.recurrence && (
            <div className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ background: '#ede9fe', color: '#5b21b6' }}>
              <RefreshCw size={9} /> {describeRecurrence(task.recurrence)}
            </div>
          )}
          {(isOverdue || isFuture) && (
            <button onClick={() => setShowReschedule(!showReschedule)}
              className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{
                background: isOverdue ? '#fee2e2' : '#e0e7ff',
                color: isOverdue ? '#b91c1c' : '#4338ca'
              }}>
              <Calendar size={9} /> {isOverdue ? 'Overdue' : formatDateShort(task.dueDate)}
            </button>
          )}
          {!isOverdue && !isFuture && !task.done && (
            <button onClick={() => setShowReschedule(!showReschedule)}
              className="text-[10px] flex items-center gap-1" style={{ color: '#a8a29e' }}>
              <Calendar size={9} />
            </button>
          )}
        </div>
        {showReschedule && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {[
              { label: 'Today', date: todayStr },
              { label: 'Tmrw', date: addDays(todayStr, 1) },
              { label: '+2d', date: addDays(todayStr, 2) },
              { label: '+1w', date: addDays(todayStr, 7) },
            ].map(opt => (
              <button key={opt.label} onClick={() => { onReschedule(opt.date); setShowReschedule(false); }}
                className="text-[10px] px-2 py-1 rounded font-semibold"
                style={{ background: '#fef3c7', color: '#92400e' }}>
                {opt.label}
              </button>
            ))}
            <input type="date" defaultValue={task.dueDate}
              onChange={e => { onReschedule(e.target.value); setShowReschedule(false); }}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: '#fff', border: '1px solid #e7e5e4' }} />
          </div>
        )}
      </div>
      <button onClick={onToggleTop3}
        className="flex-shrink-0 text-xs px-2 py-1 rounded transition-all"
        style={{
          background: starred ? d.color : 'transparent',
          color: starred ? '#fff' : '#a8a29e',
          border: starred ? 'none' : '1px solid #e7e5e4'
        }}>
        {starred ? '★' : '☆'}
      </button>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Trash2 size={14} style={{ color: '#a8a29e' }} />
      </button>
    </div>
  );
}

// ============ HABITS ============
function HabitsSection({ habits, todayStr, onToggle, onAdd, onDelete, onRename }) {
  const [editMode, setEditMode] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const sundayStr = getSundayOf(todayStr);
  const weekDates = getWeekDates(sundayStr);
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onAdd(newLabel);
    setNewLabel('');
  };

  const startRename = (habit) => {
    setEditingId(habit.id);
    setEditText(habit.label);
  };
  const commitRename = () => {
    if (editingId && editText.trim()) onRename(editingId, editText);
    setEditingId(null); setEditText('');
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#57534e' }}>
          Daily Habits
        </h2>
        <button onClick={() => { setEditMode(!editMode); setEditingId(null); }}
          className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
          style={{ color: editMode ? '#92400e' : '#78716c' }}>
          {editMode ? <><Check size={10} /> Done</> : <><Edit3 size={10} /> Edit</>}
        </button>
      </div>

      {habits.length === 0 && !editMode && (
        <div className="p-4 rounded-lg text-center text-sm mb-2" style={{ background: '#fff', border: '1px dashed #e7e5e4', color: '#a8a29e' }}>
          No habits yet. Tap Edit to add some.
        </div>
      )}

      <div className="space-y-1.5">
        {habits.map(h => {
          const done = !!h.dates[todayStr];
          const streak = calcStreak(h);
          const isEditing = editingId === h.id;

          if (editMode) {
            return (
              <div key={h.id} className="p-2.5 rounded-lg flex items-center gap-2"
                style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
                {isEditing ? (
                  <input autoFocus value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                    }}
                    className="flex-1 text-sm font-medium outline-none bg-transparent min-w-0"
                    style={{ color: '#1c1917' }} />
                ) : (
                  <button onClick={() => startRename(h)}
                    className="flex-1 text-sm font-medium text-left truncate"
                    style={{ color: '#44403c' }}>
                    {h.label}
                  </button>
                )}
                <button onClick={() => onDelete(h.id)}
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: '#fee2e2' }}>
                  <Trash2 size={11} style={{ color: '#b91c1c' }} />
                </button>
              </div>
            );
          }

          return (
            <div key={h.id} className="px-3 py-2 rounded-lg flex items-center gap-3" style={{
              background: done ? '#d1fae5' : '#fff',
              border: `1px solid ${done ? '#86efac' : '#e7e5e4'}`
            }}>
              <button onClick={() => onToggle(h.id, todayStr)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                {done
                  ? <CheckCircle2 size={15} style={{ color: '#059669', flexShrink: 0 }} />
                  : <Circle size={15} style={{ color: '#a8a29e', flexShrink: 0 }} />
                }
                <span className="text-xs font-medium truncate" style={{ color: done ? '#065f46' : '#44403c' }}>
                  {h.label}
                </span>
              </button>
              {/* Compact week dots */}
              <div className="flex gap-[3px] flex-shrink-0">
                {weekDates.map((date, i) => {
                  const dDone = !!h.dates[date];
                  const isToday = date === todayStr;
                  const isFuture = date > todayStr;
                  return (
                    <button key={date}
                      onClick={() => !isFuture && onToggle(h.id, date)}
                      disabled={isFuture}
                      title={`${dayLabels[i]} ${formatDateShort(date)}`}
                      className="w-4 h-4 rounded-full transition-all flex items-center justify-center"
                      style={{
                        background: dDone ? '#10b981' : isToday ? '#fef3c7' : '#f5f5f4',
                        border: isToday && !dDone ? '1px solid #fcd34d' : 'none',
                        opacity: isFuture ? 0.25 : 1,
                        cursor: isFuture ? 'default' : 'pointer'
                      }}>
                      <span className="text-[8px] font-bold" style={{ color: dDone ? '#fff' : isToday ? '#92400e' : '#a8a29e' }}>
                        {dayLabels[i]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-0.5 text-[10px] font-bold flex-shrink-0"
                  style={{ color: streak >= 7 ? '#92400e' : '#78716c' }}>
                  <FlameIcon size={10} /> {streak}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editMode && (
        <div className="flex gap-2 mt-2">
          <input value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="New habit..."
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#fff', border: '1px solid #e7e5e4' }} />
          <button onClick={handleAdd}
            className="px-3 rounded-lg text-sm font-semibold flex items-center gap-1"
            style={{ background: '#1c1917', color: '#fbbf24' }}>
            <Plus size={14} /> Add
          </button>
        </div>
      )}
    </section>
  );
}

// ============ SUNDAY PLAN VIEW ============
function PlanView({ state, onAddBigRock, onToggleBigRock, onDeleteBigRock, onUpdateWeek }) {
  const todayStr = today();
  const [viewSunday, setViewSunday] = useState(getSundayOf(todayStr));
  const week = state.weeks[viewSunday] || {};
  const bigRocks = week.bigRocks || [];

  const [rockText, setRockText] = useState('');
  const [rockDomain, setRockDomain] = useState('work');
  const [scripture, setScripture] = useState(week.scripture || '');
  const [planNotes, setPlanNotes] = useState(week.planNotes || '');

  useEffect(() => {
    setScripture(state.weeks[viewSunday]?.scripture || '');
    setPlanNotes(state.weeks[viewSunday]?.planNotes || '');
  }, [viewSunday, state.weeks]);

  const handleAddRock = () => {
    if (!rockText.trim() || bigRocks.length >= 3) return;
    onAddBigRock(viewSunday, { text: rockText.trim(), domain: rockDomain });
    setRockText('');
  };

  const saveScripture = () => onUpdateWeek(viewSunday, { scripture });
  const saveNotes = () => onUpdateWeek(viewSunday, { planNotes });

  const weekEnd = addDays(viewSunday, 6);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: '#a8a29e' }}>
          Sunday Planning
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: '#1c1917' }}>
          Plan the <span style={{ fontStyle: 'italic', color: '#92400e' }}>week.</span>
        </h1>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
        <button onClick={() => setViewSunday(addDays(viewSunday, -7))} className="p-1">
          <ChevronLeft size={16} style={{ color: '#78716c' }} />
        </button>
        <div className="text-center">
          <div className="text-xs font-bold" style={{ color: '#1c1917' }}>
            {formatDateShort(viewSunday)} – {formatDateShort(weekEnd)}
          </div>
          <div className="text-[10px]" style={{ color: '#78716c' }}>
            {viewSunday === getSundayOf(todayStr) ? 'This week' : viewSunday > getSundayOf(todayStr) ? 'Upcoming' : 'Past'}
          </div>
        </div>
        <button onClick={() => setViewSunday(addDays(viewSunday, 7))} className="p-1">
          <ArrowRight size={16} style={{ color: '#78716c' }} />
        </button>
      </div>

      {/* Big Rocks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#57534e' }}>
            3 Big Rocks · {bigRocks.length}/3
          </h2>
          <Target size={14} style={{ color: '#92400e' }} />
        </div>

        <div className="space-y-2 mb-3">
          {bigRocks.map((r, i) => {
            const d = getDomain(r.domain);
            const Icon = d.icon;
            return (
              <div key={r.id} className="p-3 rounded-lg flex items-center gap-3"
                style={{ background: '#fff', border: `1px solid ${d.color}30`, borderLeft: `3px solid ${d.color}` }}>
                <button onClick={() => onToggleBigRock(viewSunday, r.id)} className="flex-shrink-0">
                  {r.done
                    ? <CheckCircle2 size={18} style={{ color: '#059669' }} />
                    : <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: d.color, color: '#fff' }}>{i+1}</div>
                  }
                </button>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${r.done ? 'line-through opacity-60' : ''}`} style={{ color: '#1c1917' }}>
                    {r.text}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Icon size={10} style={{ color: d.color }} />
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: d.text }}>{d.label}</span>
                  </div>
                </div>
                <button onClick={() => onDeleteBigRock(viewSunday, r.id)}>
                  <Trash2 size={14} style={{ color: '#a8a29e' }} />
                </button>
              </div>
            );
          })}
        </div>

        {bigRocks.length < 3 && (
          <div className="p-3 rounded-lg space-y-2" style={{ background: '#fef3c7', border: '1px dashed #fcd34d' }}>
            <input value={rockText}
              onChange={e => setRockText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddRock()}
              placeholder={`Big rock ${bigRocks.length + 1}...`}
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{ background: '#fff', border: '1px solid #fde68a' }} />
            <div className="flex gap-1 flex-wrap">
              {DOMAINS.map(d => (
                <button key={d.id} onClick={() => setRockDomain(d.id)}
                  className="text-[10px] px-2 py-1 rounded font-semibold transition-all"
                  style={{
                    background: rockDomain === d.id ? d.color : '#fff',
                    color: rockDomain === d.id ? '#fff' : d.text,
                    border: `1px solid ${rockDomain === d.id ? d.color : '#e7e5e4'}`
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
            <button onClick={handleAddRock} disabled={!rockText.trim()}
              className="w-full py-2 rounded text-xs font-semibold disabled:opacity-40"
              style={{ background: '#1c1917', color: '#fbbf24' }}>
              Add Big Rock
            </button>
          </div>
        )}
      </section>

      {/* Scripture focus */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
          Scripture Focus
        </h2>
        <textarea value={scripture}
          onChange={e => setScripture(e.target.value)}
          onBlur={saveScripture}
          placeholder="Passage, theme, or word for the week... (e.g., Proverbs 22–26, Wisdom in dealings)"
          className="w-full p-3 rounded-lg text-sm outline-none resize-none"
          rows="2"
          style={{ background: '#fffbeb', border: '1px solid #fde68a', fontFamily: "'Lora', Georgia, serif" }} />
      </section>

      {/* Planning notes */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
          Planning Notes
        </h2>
        <textarea value={planNotes}
          onChange={e => setPlanNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Calendar peek, commitments, things to remember this week..."
          className="w-full p-3 rounded-lg text-sm outline-none resize-none"
          rows="4"
          style={{ background: '#fff', border: '1px solid #e7e5e4', fontFamily: "'Lora', Georgia, serif" }} />
      </section>
    </div>
  );
}

// ============ AI REFLECTION COACH ============
function AIReflectionCoach({ state, viewSunday, onSaveInsights }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const todayStr = today();
  const todayDow = new Date(todayStr + 'T00:00:00').getDay();
  const isFriday = todayDow === 5;
  const isCurrentWeek = viewSunday === getSundayOf(todayStr);

  // Only show on Fridays for the current week
  if (!isFriday || !isCurrentWeek) return null;

  const week = state.weeks[viewSunday] || {};
  const cached = week.aiInsights;

  const buildContext = () => {
    // Summarize ALL-TIME data, compact enough for context window
    const allWeeks = Object.keys(state.weeks).sort();
    const weekSummaries = allWeeks.map(sundayIso => {
      const w = state.weeks[sundayIso];
      const rocks = w.bigRocks || [];
      return {
        week: sundayIso,
        score: w.score || null,
        rocksShipped: `${rocks.filter(r => r.done).length}/${rocks.length}`,
        rocks: rocks.map(r => ({ text: r.text, domain: r.domain, done: r.done })),
        scripture: w.scripture || null,
        worked: w.worked || null,
        didntWork: w.didntWork || null,
        nextFocus: w.nextFocus || null,
      };
    });

    // Task stats per domain
    const domainStats = DOMAINS.map(d => {
      const tasks = state.tasks.filter(t => t.domain === d.id);
      const completed = tasks.filter(t => t.done).length;
      return { domain: d.label, total: tasks.length, completed };
    });

    // Habit performance
    const habitStats = state.habits.map(h => {
      const days = Object.keys(h.dates).filter(k => h.dates[k]);
      return { habit: h.label, daysCompleted: days.length, currentStreak: calcStreak(h) };
    });

    // Recent journal themes (just entry dates + lengths + tags for now)
    const journalEntries = Object.keys(state.journal).sort().slice(-14).map(date => {
      const e = state.journal[date];
      return { date, text: e.text || '', tags: e.tags || [] };
    });

    return { weekSummaries, domainStats, habitStats, journalEntries };
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    const context = buildContext();
    const prompt = `You are a reflection coach analyzing a user's weekly planning data. The user (Michael) organizes life across 6 domains: Work (Special Assets/banking), Ministry (youth ministry), Family, Projects (building sims/apps), Faith (KJV study), and Home.

Here is ALL their data:

WEEKS (Sunday plans + Friday reflections):
${JSON.stringify(context.weekSummaries, null, 2)}

DOMAIN TASK STATS (all-time):
${JSON.stringify(context.domainStats, null, 2)}

HABIT STATS:
${JSON.stringify(context.habitStats, null, 2)}

RECENT JOURNAL ENTRIES (last 14):
${JSON.stringify(context.journalEntries, null, 2)}

Identify 2-4 specific, concrete patterns across the data. Focus on things the user couldn't easily see themselves — cross-week trends, domain imbalances, recurring themes in what-worked/didn't-work, correlations between habits/journaling and week scores, or Big Rocks that keep slipping.

Be direct and specific. Reference actual weeks, domains, or entries. Avoid generic advice. Return ONLY a JSON array of observations, each with:
- title (short, 3-6 words)
- insight (1-2 sentences, specific and evidence-based)
- domain (which domain it's about, or "cross-domain")

Example format:
[
  {"title": "Faith domain slipping", "insight": "Faith has been a Big Rock 2 of 4 weeks but finished incomplete both times. Your what-didn't reflections mention 'scripture time' 3 weeks running.", "domain": "faith"}
]

Return ONLY the JSON array. No preamble, no markdown fences.`;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `API error: ${response.status}`);
      }
      const data = await response.json();
      const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      const clean = text.replace(/```json|```/g, '').trim();
      const observations = JSON.parse(clean);

      onSaveInsights(viewSunday, observations);
      setExpanded(true);
    } catch (e) {
      setError(e.message || 'Analysis failed. Try again?');
    } finally {
      setLoading(false);
    }
  };

  const hasData = Object.keys(state.weeks).length > 0;

  return (
    <div className="rounded-lg overflow-hidden" style={{
      background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
      border: '1px solid #44403c'
    }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#fbbf24' }}>
              <Brain size={14} style={{ color: '#1c1917' }} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#fbbf24' }}>
                Reflection Coach
              </div>
              <div className="text-sm font-bold" style={{ color: '#f5f5f4' }}>
                {cached ? `Last run ${new Date(cached.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Friday pattern analysis'}
              </div>
            </div>
          </div>
          {cached && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: '#fbbf24' }}>
              {expanded ? 'Hide' : 'Show'}
            </button>
          )}
        </div>

        {!cached && !loading && (
          <>
            <p className="text-xs mb-3" style={{ color: '#a8a29e' }}>
              {hasData
                ? 'I\'ll look across all your weeks, reflections, habits, and journal entries to surface patterns you might not see yourself.'
                : 'Not enough data yet. Plan a few weeks and run some reflections first.'}
            </p>
            <button onClick={runAnalysis} disabled={!hasData}
              className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#fbbf24', color: '#1c1917' }}>
              <Sparkles size={14} /> Analyze my patterns
            </button>
          </>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-3" style={{ color: '#fbbf24' }}>
            <Loader size={14} className="animate-spin" />
            <span className="text-sm">Reading your weeks…</span>
          </div>
        )}

        {error && (
          <div className="p-2 rounded text-xs mb-2" style={{ background: '#7f1d1d', color: '#fecaca' }}>
            {error}
          </div>
        )}

        {cached && expanded && (
          <div className="space-y-2 mt-3">
            {cached.observations.map((obs, i) => {
              const d = obs.domain && obs.domain !== 'cross-domain' ? getDomain(obs.domain) : null;
              return (
                <div key={i} className="p-3 rounded-lg" style={{
                  background: '#292524',
                  borderLeft: `3px solid ${d ? d.color : '#fbbf24'}`
                }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display text-sm font-bold" style={{ color: '#f5f5f4' }}>
                      {obs.title}
                    </span>
                    {d && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: d.color + '30', color: d.color }}>
                        {d.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#d6d3d1' }}>
                    {obs.insight}
                  </p>
                </div>
              );
            })}
            <button onClick={runAnalysis} disabled={loading}
              className="w-full py-2 rounded text-xs font-semibold"
              style={{ background: '#44403c', color: '#fbbf24' }}>
              {loading ? 'Re-analyzing…' : 'Re-run analysis'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ FRIDAY REFLECT VIEW ============
function ReflectView({ state, onUpdateWeek, onToggleBigRock, onSaveAIInsights }) {
  const todayStr = today();
  const [viewSunday, setViewSunday] = useState(getSundayOf(todayStr));
  const week = state.weeks[viewSunday] || {};
  const bigRocks = week.bigRocks || [];

  const [worked, setWorked] = useState(week.worked || '');
  const [didntWork, setDidntWork] = useState(week.didntWork || '');
  const [nextFocus, setNextFocus] = useState(week.nextFocus || '');
  const [score, setScore] = useState(week.score || 0);

  useEffect(() => {
    const w = state.weeks[viewSunday] || {};
    setWorked(w.worked || '');
    setDidntWork(w.didntWork || '');
    setNextFocus(w.nextFocus || '');
    setScore(w.score || 0);
  }, [viewSunday, state.weeks]);

  const rocksDone = bigRocks.filter(r => r.done).length;

  // Domain scores from tasks completed this week
  const weekDates = getWeekDates(viewSunday);
  const domainPerformance = DOMAINS.map(d => {
    const completedThisWeek = state.tasks.filter(t =>
      t.domain === d.id && t.done && t.completedAt &&
      weekDates.some(wd => new Date(t.completedAt).toISOString().slice(0,10) === wd)
    ).length;
    const totalThisWeek = state.tasks.filter(t =>
      t.domain === d.id && weekDates.some(wd => t.dueDate === wd || (t.completedAt && new Date(t.completedAt).toISOString().slice(0,10) === wd))
    ).length;
    return { domain: d, completed: completedThisWeek, total: totalThisWeek };
  }).filter(p => p.total > 0);

  const weekEnd = addDays(viewSunday, 6);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: '#a8a29e' }}>
          Friday Reflection
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: '#1c1917' }}>
          Look <span style={{ fontStyle: 'italic', color: '#92400e' }}>back.</span>
        </h1>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
        <button onClick={() => setViewSunday(addDays(viewSunday, -7))} className="p-1">
          <ChevronLeft size={16} style={{ color: '#78716c' }} />
        </button>
        <div className="text-center">
          <div className="text-xs font-bold" style={{ color: '#1c1917' }}>
            {formatDateShort(viewSunday)} – {formatDateShort(weekEnd)}
          </div>
          <div className="text-[10px]" style={{ color: '#78716c' }}>
            {viewSunday === getSundayOf(todayStr) ? 'This week' : viewSunday > getSundayOf(todayStr) ? 'Upcoming' : 'Past'}
          </div>
        </div>
        <button onClick={() => setViewSunday(addDays(viewSunday, 7))} className="p-1">
          <ArrowRight size={16} style={{ color: '#78716c' }} />
        </button>
      </div>

      {/* AI Reflection Coach — Friday only */}
      <AIReflectionCoach
        state={state}
        viewSunday={viewSunday}
        onSaveInsights={onSaveAIInsights}
      />

      {/* Big rocks review */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
          Big Rocks · {rocksDone}/{bigRocks.length} shipped
        </h2>
        {bigRocks.length === 0 ? (
          <div className="p-4 rounded-lg text-center text-sm" style={{ background: '#fff', border: '1px dashed #e7e5e4', color: '#a8a29e' }}>
            No big rocks were set for this week
          </div>
        ) : (
          <div className="space-y-2">
            {bigRocks.map(r => {
              const d = getDomain(r.domain);
              return (
                <button key={r.id} onClick={() => onToggleBigRock(viewSunday, r.id)}
                  className="w-full p-3 rounded-lg flex items-center gap-3 text-left"
                  style={{ background: r.done ? '#d1fae5' : '#fff', border: `1px solid ${r.done ? '#86efac' : '#e7e5e4'}`, borderLeft: `3px solid ${d.color}` }}>
                  {r.done
                    ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
                    : <Circle size={16} style={{ color: '#a8a29e' }} />
                  }
                  <span className={`text-sm flex-1 ${r.done ? 'line-through opacity-60' : ''}`} style={{ color: '#1c1917' }}>
                    {r.text}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: d.text }}>{d.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Domain performance */}
      {domainPerformance.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
            Domain Performance
          </h2>
          <div className="space-y-2">
            {domainPerformance.map(p => {
              const pct = p.total > 0 ? (p.completed / p.total) * 100 : 0;
              return (
                <div key={p.domain.id} className="p-3 rounded-lg" style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold" style={{ color: p.domain.text }}>{p.domain.label}</span>
                    <span className="text-[10px]" style={{ color: '#78716c' }}>{p.completed} / {p.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
                    <div className="h-full rounded-full" style={{ background: p.domain.color, width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Week score */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
          Week Score
        </h2>
        <div className="p-4 rounded-lg" style={{ background: '#1c1917' }}>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-display text-5xl font-bold" style={{ color: '#fbbf24' }}>{score}</span>
            <span className="text-xl" style={{ color: '#78716c' }}>/ 10</span>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => { setScore(n); onUpdateWeek(viewSunday, { score: n }); }}
                className="flex-1 h-8 rounded transition-all"
                style={{ background: n <= score ? '#fbbf24' : '#44403c' }} />
            ))}
          </div>
        </div>
      </section>

      {/* Reflection prompts */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#065f46' }}>
          What worked
        </h2>
        <textarea value={worked}
          onChange={e => setWorked(e.target.value)}
          onBlur={() => onUpdateWeek(viewSunday, { worked })}
          placeholder="Wins, breakthroughs, what moved the needle..."
          className="w-full p-3 rounded-lg text-sm outline-none resize-none"
          rows="3"
          style={{ background: '#d1fae5', border: '1px solid #86efac', fontFamily: "'Lora', Georgia, serif" }} />
      </section>

      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#9f1239' }}>
          What didn't
        </h2>
        <textarea value={didntWork}
          onChange={e => setDidntWork(e.target.value)}
          onBlur={() => onUpdateWeek(viewSunday, { didntWork })}
          placeholder="Where things slipped, got stuck, or need rethinking..."
          className="w-full p-3 rounded-lg text-sm outline-none resize-none"
          rows="3"
          style={{ background: '#ffe4e6', border: '1px solid #fecdd3', fontFamily: "'Lora', Georgia, serif" }} />
      </section>

      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#92400e' }}>
          Next week's focus
        </h2>
        <textarea value={nextFocus}
          onChange={e => setNextFocus(e.target.value)}
          onBlur={() => onUpdateWeek(viewSunday, { nextFocus })}
          placeholder="Lessons carried forward, adjustments to make..."
          className="w-full p-3 rounded-lg text-sm outline-none resize-none"
          rows="3"
          style={{ background: '#fef3c7', border: '1px solid #fde68a', fontFamily: "'Lora', Georgia, serif" }} />
      </section>
    </div>
  );
}

// ============ DOMAINS LIST ============
function DomainsView({ state, onOpenDomain }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: '#a8a29e' }}>Life organized</div>
        <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: '#1c1917' }}>
          Your <span style={{ fontStyle: 'italic', color: '#92400e' }}>domains.</span>
        </h1>
      </div>

      <div className="space-y-3">
        {DOMAINS.map(d => {
          const tasks = state.tasks.filter(t => t.domain === d.id);
          const open = tasks.filter(t => !t.done).length;
          const goals = (state.goals[d.id] || []).length;
          const Icon = d.icon;
          return (
            <button key={d.id} onClick={() => onOpenDomain(d.id)}
              className="w-full p-4 rounded-lg flex items-center gap-4 text-left transition-all hover:shadow-md"
              style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: d.color }}>
                <Icon size={20} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg font-bold" style={{ color: '#1c1917' }}>{d.label}</div>
                <div className="text-xs" style={{ color: '#78716c' }}>
                  {d.sub} {goals > 0 && `· ${goals} goal${goals>1?'s':''}`}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display text-2xl font-bold" style={{ color: d.color }}>{open}</div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: '#a8a29e' }}>open</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ DOMAIN DETAIL ============
function DomainDetailView({ domain, state, onBack, onToggleTask, onToggleTop3, onDeleteTask, onRescheduleTask, onAddTask, onSaveNote, onAddGoal, onDeleteGoal, onEditGoal }) {
  const d = getDomain(domain);
  const Icon = d.icon;
  const tasks = state.tasks.filter(t => t.domain === domain);
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const goals = state.goals[domain] || [];

  const [newTask, setNewTask] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(today());
  const [noteText, setNoteText] = useState(state.notes[domain] || '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editingGoalText, setEditingGoalText] = useState('');

  const handleAdd = () => {
    if (!newTask.trim()) return;
    onAddTask(newTask, newTaskDate);
    setNewTask('');
    setNewTaskDate(today());
  };

  const handleNoteBlur = () => {
    onSaveNote(noteText);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  };

  const handleAddGoal = () => {
    if (!newGoal.trim() || goals.length >= 3) return;
    onAddGoal(newGoal);
    setNewGoal('');
  };

  const startEditGoal = (g) => {
    setEditingGoalId(g.id);
    setEditingGoalText(g.text);
  };
  const commitEditGoal = () => {
    if (editingGoalId && editingGoalText.trim()) onEditGoal(editingGoalId, editingGoalText);
    setEditingGoalId(null); setEditingGoalText('');
  };

  const todayStr = today();

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#78716c' }}>
        <ChevronLeft size={14} /> All Domains
      </button>

      <div className="p-5 rounded-lg" style={{ background: d.soft, border: `1px solid ${d.color}30` }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: d.color }}>
            <Icon size={18} color="#fff" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold" style={{ color: d.text }}>{d.label}</div>
            <div className="text-xs" style={{ color: d.text, opacity: 0.7 }}>{d.sub}</div>
          </div>
        </div>
      </div>

      {/* Goals */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#57534e' }}>
            Goals · {goals.length}/3
          </h2>
          <TrendingUp size={12} style={{ color: d.color }} />
        </div>
        <div className="space-y-2">
          {goals.map(g => {
            const isEditing = editingGoalId === g.id;
            return (
              <div key={g.id} className="p-3 rounded-lg flex items-center gap-2"
                style={{ background: '#fff', border: `1px solid ${d.color}30` }}>
                <Target size={14} style={{ color: d.color }} />
                {isEditing ? (
                  <input autoFocus value={editingGoalText}
                    onChange={e => setEditingGoalText(e.target.value)}
                    onBlur={commitEditGoal}
                    onKeyDown={e => e.key === 'Enter' && commitEditGoal()}
                    className="flex-1 text-sm outline-none bg-transparent"
                    style={{ color: '#1c1917' }} />
                ) : (
                  <button onClick={() => startEditGoal(g)} className="flex-1 text-sm text-left" style={{ color: '#1c1917' }}>
                    {g.text}
                  </button>
                )}
                <button onClick={() => onDeleteGoal(g.id)}>
                  <Trash2 size={12} style={{ color: '#a8a29e' }} />
                </button>
              </div>
            );
          })}
          {goals.length < 3 && (
            <div className="flex gap-2">
              <input value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
                placeholder={`Goal ${goals.length + 1}...`}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: '#fff', border: '1px solid #e7e5e4' }} />
              <button onClick={handleAddGoal}
                className="px-3 rounded-lg text-sm font-semibold"
                style={{ background: d.color, color: '#fff' }}>
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Add task */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#57534e' }}>
          Add Task
        </h2>
        <div className="space-y-2">
          <input value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={`New ${d.label} task...`}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: '#fff', border: '1px solid #e7e5e4' }} />
          <div className="flex gap-2 items-center">
            <input type="date" value={newTaskDate}
              onChange={e => setNewTaskDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: '#fff', border: '1px solid #e7e5e4' }} />
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1"
              style={{ background: d.color, color: '#fff' }}>
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
      </section>

      {/* Open tasks */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
          Open · {open.length}
        </h2>
        {open.length === 0 ? (
          <div className="p-6 rounded-lg text-center text-sm" style={{ background: '#fff', border: '1px dashed #e7e5e4', color: '#a8a29e' }}>
            Nothing open — add one above
          </div>
        ) : (
          <div className="space-y-2">
            {open.map(t => (
              <TaskCard key={t.id} task={t} starred={t.top3} todayStr={todayStr}
                onToggle={() => onToggleTask(t.id)}
                onToggleTop3={() => onToggleTop3(t.id)}
                onDelete={() => onDeleteTask(t.id)}
                onReschedule={(d) => onRescheduleTask(t.id, d)} />
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#57534e' }}>
            Domain Notes
          </h2>
          {noteSaved && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: '#059669' }}>
              <Check size={10} /> Saved
            </span>
          )}
        </div>
        <textarea value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder={`Standing notes, context, reminders for ${d.label}...`}
          className="w-full p-3 rounded-lg text-sm outline-none resize-none"
          rows="5"
          style={{ background: '#fff', border: '1px solid #e7e5e4', fontFamily: "'Lora', Georgia, serif" }} />
      </section>

      {/* Recent completed */}
      {done.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
            Recently Completed · {done.length}
          </h2>
          <div className="space-y-2">
            {done.slice(-5).reverse().map(t => (
              <TaskCard key={t.id} task={t} todayStr={todayStr}
                onToggle={() => onToggleTask(t.id)}
                onToggleTop3={() => onToggleTop3(t.id)}
                onDelete={() => onDeleteTask(t.id)}
                onReschedule={(d) => onRescheduleTask(t.id, d)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============ JOURNAL ============
// Isolated editor — typing only re-renders this component, not the past-entries list
function JournalEntryEditor({ date, initialText, initialTags, onSave }) {
  const [entry, setEntry] = useState(initialText);
  const [tags, setTags] = useState(initialTags);
  const [saved, setSaved] = useState(false);

  // Debounced autosave: save 400ms after the user stops typing
  useEffect(() => {
    if (entry === initialText) return;
    const timer = setTimeout(() => {
      onSave(date, entry, tags);
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1200);
      return () => clearTimeout(t);
    }, 400);
    return () => clearTimeout(timer);
  }, [entry]);

  const toggleTag = (domainId) => {
    const newTags = tags.includes(domainId) ? tags.filter(t => t !== domainId) : [...tags, domainId];
    setTags(newTags);
    onSave(date, entry, newTags);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#57534e' }}>
          Write freely
        </h2>
        {saved && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: '#059669' }}>
            <Check size={10} /> Saved
          </span>
        )}
      </div>
      <textarea value={entry}
        onChange={e => setEntry(e.target.value)}
        placeholder="Answer the prompt, or write whatever's on your mind..."
        className="w-full rounded-lg outline-none resize-none"
        rows="12"
        style={{
          background: '#fffef9',
          border: '1px solid #e7e5e4',
          fontFamily: "'Lora', Georgia, serif",
          fontSize: '16px',
          color: '#1c1917',
          lineHeight: '28px',
          padding: '8px 16px 16px 16px',
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 27px, #f0dcc0 27px, #f0dcc0 28px)',
          backgroundPosition: '0 8px',
          backgroundAttachment: 'local'
        }} />

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mt-2">
        <span className="text-[10px] uppercase tracking-wider self-center" style={{ color: '#78716c' }}>Tag:</span>
        {DOMAINS.map(d => {
          const active = tags.includes(d.id);
          return (
            <button key={d.id} onClick={() => toggleTag(d.id)}
              className="text-[10px] px-2 py-0.5 rounded font-semibold transition-all"
              style={{
                background: active ? d.color : d.soft,
                color: active ? '#fff' : d.text,
                border: active ? 'none' : `1px solid ${d.color}20`
              }}>
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function JournalView({ state, onSave }) {
  const [viewDate, setViewDate] = useState(today());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState(null);

  const existing = state.journal[viewDate] || { text: '', tags: [] };

  // Filter entries
  const sortedDates = Object.keys(state.journal).sort().reverse();
  const filtered = sortedDates.filter(date => {
    const e = state.journal[date];
    if (filterTag && !e.tags?.includes(filterTag)) return false;
    if (searchQuery && !e.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: '#a8a29e' }}>
          {formatDate(viewDate)}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: '#1c1917' }}>
          Your <span style={{ fontStyle: 'italic', color: '#92400e' }}>journal.</span>
        </h1>
      </div>

      {/* Prompt */}
      <div className="p-5 rounded-lg" style={{
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        border: '1px solid #fde68a'
      }}>
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-2" style={{ color: '#92400e' }}>
          Optional Prompt
        </div>
        <p className="font-display italic text-xl leading-tight" style={{ color: '#1c1917' }}>
          "{getPromptForDate(viewDate)}"
        </p>
      </div>

      {/* Entry editor — keyed by date so it fully remounts when switching days */}
      <JournalEntryEditor
        key={viewDate}
        date={viewDate}
        initialText={existing.text}
        initialTags={existing.tags}
        onSave={onSave}
      />

      {/* Search + filter */}
      {sortedDates.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 relative">
              <Search size={12} style={{ color: '#78716c', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: '#fff', border: '1px solid #e7e5e4' }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            <button onClick={() => setFilterTag(null)}
              className="text-[10px] px-2 py-0.5 rounded font-semibold"
              style={{
                background: !filterTag ? '#1c1917' : '#fff',
                color: !filterTag ? '#fbbf24' : '#78716c',
                border: '1px solid #e7e5e4'
              }}>
              All
            </button>
            {DOMAINS.map(d => (
              <button key={d.id} onClick={() => setFilterTag(filterTag === d.id ? null : d.id)}
                className="text-[10px] px-2 py-0.5 rounded font-semibold"
                style={{
                  background: filterTag === d.id ? d.color : d.soft,
                  color: filterTag === d.id ? '#fff' : d.text
                }}>
                {d.label}
              </button>
            ))}
          </div>

          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>
            Past Entries · {filtered.length}
          </h2>
          <div className="space-y-2">
            {filtered.map(date => {
              const e = state.journal[date];
              const preview = (e.text || '').slice(0, 100) + ((e.text || '').length > 100 ? '...' : '');
              const isActive = date === viewDate;
              return (
                <button key={date} onClick={() => setViewDate(date)}
                  className="w-full p-3 rounded-lg text-left transition-all"
                  style={{
                    background: isActive ? '#fef3c7' : '#fff',
                    border: `1px solid ${isActive ? '#fcd34d' : '#e7e5e4'}`
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-bold" style={{ color: isActive ? '#92400e' : '#1c1917' }}>
                      {formatDateShort(date)}
                    </div>
                    <div className="flex gap-1">
                      {(e.tags || []).map(tagId => {
                        const d = getDomain(tagId);
                        return (
                          <div key={tagId} className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-xs italic" style={{ color: '#78716c' }}>
                    {preview || '(empty)'}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs" style={{ color: '#a8a29e' }}>
                No entries match
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ============ ARCHIVE ============
function ArchiveView({ state, onToggleTask, onDeleteTask }) {
  const [filterDomain, setFilterDomain] = useState(null);

  const completed = state.tasks.filter(t => t.done).sort((a,b) => (b.completedAt || 0) - (a.completedAt || 0));
  const filtered = filterDomain ? completed.filter(t => t.domain === filterDomain) : completed;

  // Group by date
  const grouped = filtered.reduce((acc, t) => {
    const dateKey = t.completedAt ? new Date(t.completedAt).toISOString().slice(0,10) : t.dueDate;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(t);
    return acc;
  }, {});
  const sortedGroups = Object.keys(grouped).sort().reverse();

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: '#a8a29e' }}>
          Completed work
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: '#1c1917' }}>
          Your <span style={{ fontStyle: 'italic', color: '#92400e' }}>archive.</span>
        </h1>
      </div>

      <div className="p-4 rounded-lg" style={{ background: '#1c1917' }}>
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: '#fbbf24' }}>
          Total Completed
        </div>
        <div className="font-display text-4xl font-bold" style={{ color: '#f5f5f4' }}>
          {completed.length}
        </div>
      </div>

      {/* Domain filter */}
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setFilterDomain(null)}
          className="text-[10px] px-2 py-1 rounded font-semibold"
          style={{
            background: !filterDomain ? '#1c1917' : '#fff',
            color: !filterDomain ? '#fbbf24' : '#78716c',
            border: '1px solid #e7e5e4'
          }}>
          All
        </button>
        {DOMAINS.map(d => {
          const count = completed.filter(t => t.domain === d.id).length;
          if (count === 0) return null;
          return (
            <button key={d.id} onClick={() => setFilterDomain(filterDomain === d.id ? null : d.id)}
              className="text-[10px] px-2 py-1 rounded font-semibold"
              style={{
                background: filterDomain === d.id ? d.color : d.soft,
                color: filterDomain === d.id ? '#fff' : d.text
              }}>
              {d.label} · {count}
            </button>
          );
        })}
      </div>

      {/* Grouped by date */}
      {sortedGroups.length === 0 ? (
        <div className="p-8 rounded-lg text-center" style={{ background: '#fff', border: '1px dashed #e7e5e4' }}>
          <Archive size={20} style={{ color: '#a8a29e', margin: '0 auto 8px' }} />
          <p className="text-sm" style={{ color: '#78716c' }}>No completed tasks yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(date => (
            <div key={date}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#57534e' }}>
                {formatDateMedium(date)}
              </h3>
              <div className="space-y-2">
                {grouped[date].map(t => {
                  const d = getDomain(t.domain);
                  return (
                    <div key={t.id} className="p-3 rounded-lg flex items-center gap-3 group"
                      style={{ background: '#f5f5f4', border: '1px solid #e7e5e4' }}>
                      <button onClick={() => onToggleTask(t.id)}>
                        <CheckCircle2 size={16} style={{ color: '#059669' }} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm line-through" style={{ color: '#78716c' }}>{t.text}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: d.text }}>{d.label}</span>
                        </div>
                      </div>
                      <button onClick={() => onDeleteTask(t.id)} className="opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} style={{ color: '#a8a29e' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ MODALS ============
function InboxModal({ state, onClose, onAdd, onDelete, onPromote }) {
  const [newItem, setNewItem] = useState('');
  const [promotingId, setPromotingId] = useState(null);

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onAdd(newItem);
    setNewItem('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(28, 25, 23, 0.5)' }}>
      <div className="w-full max-w-2xl rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: '#faf7f2' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#92400e' }}>Quick Capture</div>
            <h2 className="font-display text-2xl font-bold" style={{ color: '#1c1917' }}>Inbox</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#e7e5e4' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <input value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Quick thought, task, or idea..."
            className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: '#fff', border: '1px solid #e7e5e4' }}
            autoFocus />
          <button onClick={handleAdd} className="px-4 rounded-lg text-sm font-semibold"
            style={{ background: '#1c1917', color: '#fbbf24' }}>
            Capture
          </button>
        </div>

        {state.inbox.length === 0 ? (
          <div className="p-8 rounded-lg text-center" style={{ background: '#fff', border: '1px dashed #e7e5e4' }}>
            <Inbox size={20} className="mx-auto mb-2" style={{ color: '#a8a29e' }} />
            <p className="text-sm" style={{ color: '#78716c' }}>Inbox is empty. Capture anything.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {state.inbox.map(item => (
              <div key={item.id} className="p-3 rounded-lg" style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm flex-1" style={{ color: '#1c1917' }}>{item.text}</p>
                  <button onClick={() => onDelete(item.id)}>
                    <Trash2 size={14} style={{ color: '#a8a29e' }} />
                  </button>
                </div>
                {promotingId === item.id ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {DOMAINS.map(d => (
                      <button key={d.id} onClick={() => { onPromote(item.id, d.id); setPromotingId(null); }}
                        className="text-[10px] px-2 py-1 rounded font-semibold"
                        style={{ background: d.soft, color: d.text }}>
                        {d.label}
                      </button>
                    ))}
                    <button onClick={() => setPromotingId(null)}
                      className="text-[10px] px-2 py-1 rounded" style={{ color: '#a8a29e' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setPromotingId(item.id)}
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: '#92400e' }}>
                    → Move to domain
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }) {
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const todayIso = today();

  // Live-parse the input as the user types
  const parsed = useMemo(() => {
    if (!input.trim()) return null;
    return parseTaskInput(input, todayIso);
  }, [input, todayIso]);

  const handleSubmit = () => {
    if (!parsed || !parsed.text) return;
    onAdd({
      text: parsed.text,
      domain: parsed.domain,
      dueDate: parsed.dueDate,
      top3: parsed.top3,
      recurrence: parsed.recurrence,
    });
  };

  const parsedDomain = parsed ? getDomain(parsed.domain) : null;
  const DomainIcon = parsedDomain?.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(28, 25, 23, 0.5)' }}>
      <div className="w-full max-w-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#faf7f2' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#92400e' }}>
              Quick Add
            </div>
            <h2 className="font-display text-2xl font-bold" style={{ color: '#1c1917' }}>New task</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHelp(!showHelp)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: showHelp ? '#fef3c7' : '#e7e5e4' }}>
              <HelpCircle size={14} style={{ color: showHelp ? '#92400e' : '#57534e' }} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#e7e5e4' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <input value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="e.g. finish brisket rub tomorrow #home ⭐"
          className="w-full px-4 py-3 rounded-lg text-base outline-none mb-3 font-display"
          style={{ background: '#fff', border: '1px solid #e7e5e4', fontSize: '16px' }}
          autoFocus />

        {/* Live parse preview */}
        {parsed && parsed.text && (
          <div className="p-3 rounded-lg mb-3 flex flex-wrap items-center gap-2" style={{
            background: '#fff',
            border: `1px solid ${parsedDomain.color}30`,
            borderLeft: `3px solid ${parsedDomain.color}`
          }}>
            <span className="text-sm font-medium" style={{ color: '#1c1917' }}>{parsed.text}</span>
            <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold"
              style={{ background: parsedDomain.soft, color: parsedDomain.text }}>
              <DomainIcon size={10} /> {parsedDomain.label}
            </div>
            <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold"
              style={{
                background: parsed.dueDate === todayIso ? '#fef3c7' : '#f5f5f4',
                color: parsed.dueDate === todayIso ? '#92400e' : '#57534e'
              }}>
              <Calendar size={10} />
              {parsed.dueDate === todayIso ? 'Today' :
               parsed.dueDate === addDays(todayIso, 1) ? 'Tomorrow' :
               formatDateShort(parsed.dueDate)}
            </div>
            {parsed.top3 && (
              <div className="text-[10px] px-2 py-0.5 rounded font-semibold"
                style={{ background: '#fef3c7', color: '#92400e' }}>
                ★ Top 3
              </div>
            )}
            {parsed.recurrence && (
              <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold"
                style={{ background: '#ede9fe', color: '#5b21b6' }}>
                <RefreshCw size={10} /> {describeRecurrence(parsed.recurrence)}
              </div>
            )}
          </div>
        )}

        {/* Help cheatsheet */}
        {showHelp && (
          <div className="p-4 rounded-lg mb-3 space-y-2 text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div className="font-bold uppercase tracking-wider text-[10px] mb-1" style={{ color: '#92400e' }}>Syntax Reference</div>
            <div><strong>Domains:</strong> <code>#work</code> <code>#ministry</code> <code>#family</code> <code>#projects</code> <code>#faith</code> <code>#home</code> (also <code>#w #m #fam #p #fi #h</code>)</div>
            <div><strong>Dates:</strong> <code>today</code> <code>tomorrow</code> <code>mon</code>..<code>sun</code> <code>next mon</code> <code>+2d</code> <code>+1w</code> <code>4/29</code> <code>apr 29</code></div>
            <div><strong>Top 3:</strong> <code>⭐</code> or <code>!</code> or <code>*</code> anywhere</div>
            <div><strong>Repeat:</strong> <code>every day</code> <code>every weekday</code> <code>every mon</code> <code>every 2 weeks</code> <code>monthly</code></div>
            <div className="pt-2 border-t" style={{ borderColor: '#fde68a' }}>
              <div className="font-bold mb-1" style={{ color: '#92400e' }}>Examples:</div>
              <div className="opacity-80"><code>review loan files tomorrow #work ⭐</code></div>
              <div className="opacity-80"><code>KJV reading every weekday #faith</code></div>
              <div className="opacity-80"><code>oil change apr 29 #home</code></div>
              <div className="opacity-80"><code>youth team sync every wed #ministry</code></div>
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={!parsed || !parsed.text}
          className="w-full py-3 rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1c1917', color: '#fbbf24' }}>
          Add task {parsed && parsed.text && '↵'}
        </button>

        <div className="text-[10px] text-center mt-2" style={{ color: '#a8a29e' }}>
          Press Enter to add · Tap <HelpCircle size={10} className="inline" /> for syntax
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose, onExport, onImport, onReset, state }) {
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ok = onImport(ev.target.result);
      if (ok) {
        setImportSuccess(true);
        setTimeout(onClose, 1000);
      } else {
        setImportError('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const taskCount = state.tasks.length;
  const journalCount = Object.keys(state.journal).length;
  const habitCount = state.habits.length;
  const weekCount = Object.keys(state.weeks).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(28, 25, 23, 0.5)' }}>
      <div className="w-full max-w-2xl rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: '#faf7f2' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold" style={{ color: '#1c1917' }}>Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#e7e5e4' }}>
            <X size={16} />
          </button>
        </div>

        <section className="mb-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>Your Data</h3>
          <div className="p-4 rounded-lg grid grid-cols-2 gap-3" style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
            <DataStat label="Tasks" value={taskCount} />
            <DataStat label="Journal Entries" value={journalCount} />
            <DataStat label="Habits" value={habitCount} />
            <DataStat label="Weeks Planned" value={weekCount} />
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#57534e' }}>Backup & Restore</h3>
          <button onClick={onExport}
            className="w-full p-3 rounded-lg flex items-center gap-3 mb-2"
            style={{ background: '#1c1917', color: '#fbbf24' }}>
            <Download size={16} />
            <div className="text-left">
              <div className="text-sm font-semibold">Export to JSON</div>
              <div className="text-[10px] opacity-70">Download all your data as a backup file</div>
            </div>
          </button>
          <label className="w-full p-3 rounded-lg flex items-center gap-3 cursor-pointer"
            style={{ background: '#fff', border: '1px solid #e7e5e4' }}>
            <Upload size={16} style={{ color: '#57534e' }} />
            <div className="text-left flex-1">
              <div className="text-sm font-semibold" style={{ color: '#1c1917' }}>Import from JSON</div>
              <div className="text-[10px]" style={{ color: '#78716c' }}>Restore from a backup (replaces current data)</div>
            </div>
            <input type="file" accept=".json" onChange={handleFile} className="hidden" />
          </label>
          {importError && <p className="text-xs mt-2" style={{ color: '#b91c1c' }}>{importError}</p>}
          {importSuccess && <p className="text-xs mt-2" style={{ color: '#059669' }}>Imported successfully</p>}
        </section>

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#b91c1c' }}>Danger Zone</h3>
          <button onClick={onReset}
            className="w-full p-3 rounded-lg flex items-center gap-3"
            style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            <Trash2 size={16} />
            <div className="text-left">
              <div className="text-sm font-semibold">Reset all data</div>
              <div className="text-[10px] opacity-70">Wipe everything and start fresh</div>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
}

function DataStat({ label, value }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold" style={{ color: '#1c1917' }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: '#78716c' }}>{label}</div>
    </div>
  );
}
