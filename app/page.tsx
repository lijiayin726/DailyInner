'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type MoodGroup = 'joy' | 'calm' | 'sad';
type ViewMode = 'day' | 'week' | 'month';
type TimelineMode = 'mood' | 'body' | 'combined';

type MoodOption = {
  group: MoodGroup;
  groupLabel: string;
  label: string;
  note: string;
  score: number;
  activation: number;
  color: string;
};

type MoodEntry = {
  id: string;
  date: string;
  time: string;
  mood: string;
  group: MoodGroup;
  text: string;
  mediaName: string;
  mediaDataUrl?: string;
  mediaKey?: string;
  mediaType?: string;
};

type BodyEntry = {
  id: string;
  date: string;
  text: string;
  periodStart: boolean;
  periodEnd: boolean;
};

const moodGroups: { group: MoodGroup; label: string; hint: string; color: string }[] = [
  { group: 'joy', label: '高兴', hint: '愉悦、兴奋、过度兴奋', color: '#d87936' },
  { group: 'calm', label: '平静', hint: '稳定、麻木、解离感', color: '#5f9a8b' },
  { group: 'sad', label: '难过', hint: '低落、兴趣减弱、失能感', color: '#6b62a9' },
];

const moodOptions: MoodOption[] = [
  { group: 'joy', groupLabel: '高兴', label: '愉悦', note: '日常情绪', score: 1, activation: 2, color: '#e3a52f' },
  { group: 'joy', groupLabel: '高兴', label: '有点兴奋', note: '有点小轻躁狂', score: 2, activation: 3, color: '#d87936' },
  { group: 'joy', groupLabel: '高兴', label: '太兴奋了', note: '轻躁狂/躁狂', score: 3, activation: 4, color: '#c84f4f' },
  { group: 'calm', groupLabel: '平静', label: '无事发生', note: '稳定状态', score: 0, activation: 1, color: '#5f9a8b' },
  { group: 'calm', groupLabel: '平静', label: '有点麻木', note: '兴趣减弱', score: 0, activation: 0, color: '#7193b1' },
  { group: 'calm', groupLabel: '平静', label: '十分麻木', note: '严重解离', score: 0, activation: -1, color: '#687184' },
  { group: 'sad', groupLabel: '难过', label: '有点难过', note: '尚可转移注意力', score: -1, activation: 1, color: '#7786bf' },
  { group: 'sad', groupLabel: '难过', label: '比较难过', note: '兴趣减弱', score: -2, activation: 0, color: '#6b62a9' },
  { group: 'sad', groupLabel: '难过', label: '十分难过', note: '什么都干不了', score: -3, activation: -1, color: '#514278' },
];

const today = new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

const demoMoodEntries: MoodEntry[] = [
  { id: 'm1', date: today, time: '08:35', mood: '无事发生', group: 'calm', text: '早上状态还算平稳。', mediaName: '' },
  { id: 'm2', date: today, time: '13:20', mood: '有点兴奋', group: 'joy', text: '想法很多，先记下来观察。', mediaName: '' },
  { id: 'm3', date: today, time: '20:10', mood: '有点难过', group: 'sad', text: '身体有些累，准备早点休息。', mediaName: '' },
];

const demoBodyEntries: BodyEntry[] = [
  { id: 'b1', date: today, text: '腹部有点不适，精神容易疲惫。', periodStart: false, periodEnd: false },
];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getMood(label: string) {
  return moodOptions.find((item) => item.label === label) ?? moodOptions[3];
}

function formatDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function toLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const parsed = toLocalDate(date);
  parsed.setDate(parsed.getDate() + days);
  return toDateKey(parsed);
}

function addMonths(date: string, months: number) {
  const parsed = toLocalDate(date);
  parsed.setMonth(parsed.getMonth() + months);
  return toDateKey(parsed);
}

function getWeekStart(date: string) {
  const parsed = toLocalDate(date);
  const day = parsed.getDay() || 7;
  parsed.setDate(parsed.getDate() - day + 1);
  return toDateKey(parsed);
}

function getMonthStart(date: string) {
  const parsed = toLocalDate(date);
  return toDateKey(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
}

function getMonthEnd(date: string) {
  const parsed = toLocalDate(date);
  return toDateKey(new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0));
}

function getTrendRange(mode: ViewMode, anchorDate: string) {
  if (mode === 'day') return { start: anchorDate, end: anchorDate };
  if (mode === 'week') {
    const start = getWeekStart(anchorDate);
    return { start, end: addDays(start, 6) };
  }
  return { start: getMonthStart(anchorDate), end: getMonthEnd(anchorDate) };
}

function formatTrendRangeLabel(mode: ViewMode, start: string, end: string) {
  if (mode === 'day') return start;
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${start} 至 ${formatDateLabel(end)}`;
  }
  return `${start} 至 ${end}`;
}

function moodScoreToY(score: number) {
  return 105 - score * 28;
}

function calmDepth(label: string) {
  if (label === '十分麻木') return 2;
  if (label === '有点麻木') return 1;
  return 0;
}

function chartPointStyle(point: { group: MoodGroup | 'mixed'; calmDepth: number }) {
  if (point.group === 'calm') {
    const colors = ['#eef5f2', '#86aaa1', '#4f746d'];
    return {
      fill: colors[Math.round(point.calmDepth)] ?? colors[0],
      radius: 6,
      stroke: '#4f746d',
      strokeWidth: 3,
    };
  }
  if (point.group === 'joy') return { fill: '#fff6da', radius: 6, stroke: '#d87936', strokeWidth: 3 };
  if (point.group === 'sad') return { fill: '#e8f1fb', radius: 6, stroke: '#4f78a8', strokeWidth: 3 };
  return { fill: '#f7f3ea', radius: 6, stroke: '#4f746d', strokeWidth: 3 };
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function openMediaDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mood-web-media', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('media');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putMediaBlob(key: string, blob: Blob) {
  const db = await openMediaDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('media', 'readwrite');
    transaction.objectStore('media').put(blob, key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getMediaBlob(key: string) {
  const db = await openMediaDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction('media', 'readonly');
    const request = transaction.objectStore('media').get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function deleteMediaBlob(key: string) {
  const db = await openMediaDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('media', 'readwrite');
    transaction.objectStore('media').delete(key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    image.src = url;
  });
}

async function compressImageAsDataUrl(file: File) {
  const image = await loadImageFromFile(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('图片压缩失败');
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function Home() {
  const recordPanelRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(demoMoodEntries);
  const [bodyEntries, setBodyEntries] = useState<BodyEntry[]>(demoBodyEntries);
  const [selectedMood, setSelectedMood] = useState('');
  const [moodDate, setMoodDate] = useState(today);
  const [moodTime, setMoodTime] = useState(nowTime());
  const [moodText, setMoodText] = useState('');
  const [mediaName, setMediaName] = useState('');
  const [mediaDataUrl, setMediaDataUrl] = useState('');
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [pendingMediaFile, setPendingMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState('');
  const [bodyDate, setBodyDate] = useState(today);
  const [bodyText, setBodyText] = useState('');
  const [periodStart, setPeriodStart] = useState(false);
  const [periodEnd, setPeriodEnd] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [trendDate, setTrendDate] = useState(today);
  const [timelineDate, setTimelineDate] = useState(today);
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('combined');
  const [aiModel, setAiModel] = useState('可配置自己的AI（该功能暂未开放）');
  const [activeMoodGroup, setActiveMoodGroup] = useState<MoodGroup | null>(null);
  const [pinnedMoodGroup, setPinnedMoodGroup] = useState<MoodGroup | null>(null);
  const [moodTimeTouched, setMoodTimeTouched] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [mediaLoadErrors, setMediaLoadErrors] = useState<Record<string, boolean>>({});

  function resetMediaInput() {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaName('');
    setMediaDataUrl('');
    setMediaPreviewUrl('');
    setPendingMediaFile(null);
    setMediaType('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  useEffect(() => {
    try {
      const storedMood = window.localStorage.getItem('mood-web:moods');
      const storedBody = window.localStorage.getItem('mood-web:body');
      const storedModel = window.localStorage.getItem('mood-web:model');
      if (storedMood) setMoodEntries(JSON.parse(storedMood));
      if (storedBody) setBodyEntries(JSON.parse(storedBody));
      if (storedModel) {
        setAiModel(storedModel === '本地总结模式' ? '可配置自己的AI（该功能暂未开放）' : storedModel);
      }
    } catch {
      setSaveNotice('本机旧数据读取失败，已先显示默认示例');
      window.setTimeout(() => setSaveNotice(''), 2600);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem('mood-web:moods', JSON.stringify(moodEntries));
    } catch {
      setSaveNotice('本机存储空间不足，图片可能无法保存');
      window.setTimeout(() => setSaveNotice(''), 3000);
    }
  }, [moodEntries, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem('mood-web:body', JSON.stringify(bodyEntries));
    } catch {
      setSaveNotice('本机存储空间不足，身体记录可能无法保存');
      window.setTimeout(() => setSaveNotice(''), 3000);
    }
  }, [bodyEntries, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem('mood-web:model', aiModel);
    } catch {
      setSaveNotice('本机存储空间不足，模型配置可能无法保存');
      window.setTimeout(() => setSaveNotice(''), 3000);
    }
  }, [aiModel, storageReady]);

  useEffect(() => {
    let canceled = false;
    const objectUrls: string[] = [];

    async function loadMediaUrls() {
      const nextUrls: Record<string, string> = {};
      await Promise.all(moodEntries.map(async (entry) => {
        if (!entry.mediaKey || entry.mediaDataUrl) return;
        try {
          const blob = await getMediaBlob(entry.mediaKey);
          if (!blob || canceled) return;
          const typedBlob = blob.type ? blob : new Blob([blob], { type: entry.mediaType || 'video/mp4' });
          const url = entry.mediaType?.startsWith('video/') && typedBlob.size <= 30 * 1024 * 1024
            ? await readFileAsDataUrl(typedBlob)
            : URL.createObjectURL(typedBlob);
          if (url.startsWith('blob:')) objectUrls.push(url);
          nextUrls[entry.id] = url;
        } catch {
          // 媒体读取失败时保留文件名，不影响页面其他记录。
        }
      }));
      if (!canceled) setMediaUrls(nextUrls);
    }

    loadMediaUrls();
    return () => {
      canceled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [moodEntries]);

  useEffect(() => {
    if (moodTimeTouched || moodDate !== today) return undefined;
    const timer = window.setInterval(() => {
      setMoodTime(nowTime());
    }, 15000);
    return () => window.clearInterval(timer);
  }, [moodDate, moodTimeTouched]);

  useEffect(() => {
    function closePickerOnOutsideClick(event: PointerEvent) {
      if (recordPanelRef.current?.contains(event.target as Node)) return;
      setActiveMoodGroup(null);
      setPinnedMoodGroup(null);
      setSelectedMood('');
    }
    window.addEventListener('pointerdown', closePickerOnOutsideClick);
    return () => window.removeEventListener('pointerdown', closePickerOnOutsideClick);
  }, []);

  const trendRange = useMemo(() => getTrendRange(viewMode, trendDate), [trendDate, viewMode]);
  const trendRangeLabel = useMemo(
    () => formatTrendRangeLabel(viewMode, trendRange.start, trendRange.end),
    [trendRange.end, trendRange.start, viewMode],
  );

  const visibleMoodEntries = useMemo(() => {
    return moodEntries
      .filter((entry) => entry.date >= trendRange.start && entry.date <= trendRange.end)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [moodEntries, trendRange.end, trendRange.start]);

  const visibleBodyEntries = useMemo(() => {
    return bodyEntries
      .filter((entry) => entry.date >= trendRange.start && entry.date <= trendRange.end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bodyEntries, trendRange.end, trendRange.start]);

  const chartPoints = useMemo(() => {
    if (viewMode === 'day') {
      return visibleMoodEntries.map((entry) => {
        const mood = getMood(entry.mood);
        return {
          key: entry.id,
          label: entry.time,
          average: mood.score,
          activation: mood.activation,
          group: mood.group,
          calmDepth: calmDepth(mood.label),
        };
      });
    }
    const byDate = new Map<string, MoodEntry[]>();
    visibleMoodEntries.forEach((entry) => {
      byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
    });
    return Array.from(byDate.entries()).map(([date, entries]) => {
      const average = entries.reduce((sum, entry) => sum + getMood(entry.mood).score, 0) / entries.length;
      const activation = entries.reduce((sum, entry) => sum + getMood(entry.mood).activation, 0) / entries.length;
      const calmEntries = entries.filter((entry) => getMood(entry.mood).group === 'calm');
      const depth = calmEntries.length
        ? calmEntries.reduce((sum, entry) => sum + calmDepth(entry.mood), 0) / calmEntries.length
        : 0;
      const dominantGroup = entries.length === calmEntries.length
        ? 'calm'
        : entries.some((entry) => getMood(entry.mood).group === 'joy')
          ? 'joy'
          : entries.some((entry) => getMood(entry.mood).group === 'sad')
            ? 'sad'
            : 'mixed';
      return { key: date, label: formatDateLabel(date), average, activation, group: dominantGroup, calmDepth: depth };
    });
  }, [viewMode, visibleMoodEntries]);

  const aiSummary = useMemo(() => {
    const joyCount = visibleMoodEntries.filter((entry) => entry.group === 'joy').length;
    const calmCount = visibleMoodEntries.filter((entry) => entry.group === 'calm').length;
    const sadCount = visibleMoodEntries.filter((entry) => entry.group === 'sad').length;
    const elevatedCount = visibleMoodEntries.filter((entry) => ['有点兴奋', '太兴奋了'].includes(entry.mood)).length;
    const numbCount = visibleMoodEntries.filter((entry) => ['有点麻木', '十分麻木'].includes(entry.mood)).length;
    const periodDays = visibleBodyEntries.filter((entry) => entry.periodStart || entry.periodEnd || entry.text.includes('经')).length;
    const mainLine = visibleMoodEntries.length
      ? `当前范围内共有 ${visibleMoodEntries.length} 条情绪记录，其中高兴 ${joyCount} 条，平静 ${calmCount} 条，难过 ${sadCount} 条。`
      : '当前范围内还没有情绪记录。';
    const suggestion = elevatedCount >= 2
      ? '兴奋记录偏多时，建议先减少刺激、保证睡眠，并观察是否需要联系医生或可信任的人。'
      : sadCount >= 2
        ? '难过记录偏多时，可以先降低任务强度，记录诱因，并给自己安排一个低门槛的支持动作。'
        : numbCount >= 2
          ? '麻木感出现时，适合做很小的身体锚定动作，比如喝水、洗脸、触摸稳定物体。'
          : '目前记录没有明显集中风险，可以继续保持轻量记录，尤其留意睡眠、身体不适和经期前后的变化。';
    const periodLine = periodDays ? '身体记录里出现了经期或相关描述，合并视图会更适合观察情绪与周期的关系。' : '还没有明显周期记录，后续可以标记经期开始和结束。';
    return `${mainLine} ${periodLine} ${suggestion}`;
  }, [visibleBodyEntries, visibleMoodEntries]);

  async function addMood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMood) {
      setSaveNotice('请先选择一个情绪等级');
      window.setTimeout(() => setSaveNotice(''), 2200);
      return;
    }
    const mood = getMood(selectedMood);
    const id = makeId('mood');
    const mediaKey = pendingMediaFile?.type.startsWith('video/') ? `${id}-media` : undefined;
    const newEntry: MoodEntry = {
      id,
      date: moodDate,
      time: moodTime,
      mood: mood.label,
      group: mood.group,
      text: moodText,
      mediaName,
      mediaDataUrl,
      mediaKey,
      mediaType,
    };
    let mediaSaved = true;
    if (pendingMediaFile && mediaKey) {
      try {
        await putMediaBlob(mediaKey, pendingMediaFile);
      } catch {
        mediaSaved = false;
      }
    }
    const nextEntries = [...moodEntries, newEntry];
    const shouldDropImage = Boolean(mediaDataUrl) && JSON.stringify(nextEntries).length > 3_800_000;
    setMoodEntries(
      shouldDropImage
        ? [...moodEntries, { ...newEntry, mediaDataUrl: '', mediaKey: undefined }]
        : mediaSaved
          ? nextEntries
          : [...moodEntries, { ...newEntry, mediaKey: undefined }],
    );
    setMoodText('');
    resetMediaInput();
    setSelectedMood('');
    setActiveMoodGroup(null);
    setPinnedMoodGroup(null);
    setMoodTime(nowTime());
    setMoodTimeTouched(false);
    setSaveNotice(
      shouldDropImage
        ? `已保存 ${mood.groupLabel} · ${mood.label}，但图片因本机空间不足未保存`
        : mediaSaved
          ? `已保存 ${mood.groupLabel} · ${mood.label}`
          : `已保存 ${mood.groupLabel} · ${mood.label}，但视频因本机空间不足未保存`,
    );
    window.setTimeout(() => setSaveNotice(''), 2200);
  }

  function addBody(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBodyEntries((entries) => [
      ...entries,
      {
        id: makeId('body'),
        date: bodyDate,
        text: bodyText || '今天记录了身体状态。',
        periodStart,
        periodEnd,
      },
    ]);
    setBodyText('');
    setPeriodStart(false);
    setPeriodEnd(false);
    setSaveNotice('身体记录已保存');
    window.setTimeout(() => setSaveNotice(''), 2200);
  }

  async function selectMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      resetMediaInput();
      return;
    }
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaName(file.name);
    setMediaType(file.type);
    setMediaDataUrl('');
    setMediaPreviewUrl('');
    setPendingMediaFile(null);
    if (file.type.startsWith('video/')) {
      if (file.size > 80 * 1024 * 1024) {
        resetMediaInput();
        setSaveNotice('视频太大，测试版暂时请选 80MB 以内的视频');
        window.setTimeout(() => setSaveNotice(''), 3000);
        return;
      }
      setPendingMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      setSaveNotice('视频已添加，保存后会在时间线里播放');
      window.setTimeout(() => setSaveNotice(''), 2600);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setSaveNotice('暂只支持图片预览');
      window.setTimeout(() => setSaveNotice(''), 2600);
      return;
    }
    try {
      const imageDataUrl = file.type === 'image/svg+xml' ? await readFileAsDataUrl(file) : await compressImageAsDataUrl(file);
      if (imageDataUrl.length > 1_200_000) throw new Error('图片太大');
      setMediaType('image/jpeg');
      setMediaDataUrl(imageDataUrl);
      if (file.size > 700_000) {
        setSaveNotice('图片已自动压缩，手机端保存更稳定');
        window.setTimeout(() => setSaveNotice(''), 2600);
      }
    } catch {
      resetMediaInput();
      setSaveNotice('这张图片太大，已取消添加，避免页面崩溃');
      window.setTimeout(() => setSaveNotice(''), 3000);
    }
  }

  function deleteMood(id: string) {
    const entry = moodEntries.find((item) => item.id === id);
    if (entry?.mediaKey) void deleteMediaBlob(entry.mediaKey);
    setMoodEntries((entries) => entries.filter((entry) => entry.id !== id));
    setSaveNotice('情绪记录已删除');
    window.setTimeout(() => setSaveNotice(''), 2200);
  }

  function deleteBody(id: string) {
    setBodyEntries((entries) => entries.filter((entry) => entry.id !== id));
    setSaveNotice('身体记录已删除');
    window.setTimeout(() => setSaveNotice(''), 2200);
  }

  function shiftTrendRange(direction: -1 | 1) {
    if (viewMode === 'day') setTrendDate((date) => addDays(date, direction));
    if (viewMode === 'week') setTrendDate((date) => addDays(date, direction * 7));
    if (viewMode === 'month') setTrendDate((date) => addMonths(date, direction));
  }

  function shiftTimelineDate(direction: -1 | 1) {
    setTimelineDate((date) => addDays(date, direction));
  }

  const timelineItems = [
    ...(timelineMode !== 'body'
      ? moodEntries
        .filter((entry) => entry.date === timelineDate)
        .map((entry) => ({ kind: 'mood' as const, sort: `${entry.date} ${entry.time}`, entry }))
      : []),
    ...(timelineMode !== 'mood'
      ? bodyEntries
        .filter((entry) => entry.date === timelineDate)
        .map((entry) => ({ kind: 'body' as const, sort: `${entry.date} 12:00`, entry }))
      : []),
  ].sort((a, b) => b.sort.localeCompare(a.sort));

  const chartWidth = 620;
  const chartHeight = 210;
  const points = chartPoints.map((point, index) => {
    const x = chartPoints.length === 1 ? chartWidth / 2 : (index / (chartPoints.length - 1)) * chartWidth;
    const y = moodScoreToY(point.average);
    return `${x},${y}`;
  }).join(' ');
  const chartLabelInterval = chartPoints.length > 8 ? Math.ceil(chartPoints.length / 6) : 1;
  const visibleChartLabels = chartPoints.filter((_, index) => (
    chartPoints.length <= 8
    || index === 0
    || index === chartPoints.length - 1
    || index % chartLabelInterval === 0
  ));

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#26231f]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="app-header">
          <div>
            <p className="eyebrow">inner weather</p>
            <h1>DailyInner</h1>
            <p className="subtle">记录日常情绪、身体感受与生活线索，帮你温柔地看见自己的变化。</p>
          </div>
          <div className="privacy-pill">数据暂存本地，删除APP时将清空数据</div>
        </header>

        <section className="dashboard-grid">
          <form className="panel record-panel" onSubmit={addMood} ref={recordPanelRef}>
            <div className="panel-title">
              <span>记录此刻情绪</span>
            </div>
            <div className="field-row">
              <label>
                日期
                <input type="date" value={moodDate} onChange={(event) => setMoodDate(event.target.value)} />
              </label>
              <div className="time-field">
                <label>
                  时间
                  <input
                    type="time"
                    value={moodTime}
                    onChange={(event) => {
                      setMoodTime(event.target.value);
                      setMoodTimeTouched(true);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMoodDate(today);
                    setMoodTime(nowTime());
                    setMoodTimeTouched(false);
                  }}
                >
                  现在
                </button>
              </div>
            </div>
            <div className="emotion-picker">
              {moodGroups.map((group) => {
                const levels = moodOptions.filter((mood) => mood.group === group.group);
                const selectedInGroup = levels.some((mood) => mood.label === selectedMood);
                const openMoodGroup = activeMoodGroup ?? pinnedMoodGroup;
                const isOpen = openMoodGroup === group.group;
                return (
                  <section
                    className={isOpen ? 'emotion-group open' : 'emotion-group'}
                    key={group.group}
                    onBlur={(event) => {
                      const nextTarget = event.relatedTarget as Node | null;
                      if (!nextTarget || !recordPanelRef.current?.contains(nextTarget)) setActiveMoodGroup(null);
                    }}
                    onFocus={() => setActiveMoodGroup(group.group)}
                    onMouseEnter={() => setActiveMoodGroup(group.group)}
                    onMouseLeave={() => {
                      if (pinnedMoodGroup !== group.group) setActiveMoodGroup(null);
                    }}
                    style={{ '--group-color': group.color } as React.CSSProperties}
                  >
                    <button
                      className="emotion-main"
                      onClick={() => {
                        if (isOpen) {
                          setActiveMoodGroup(null);
                          setPinnedMoodGroup(null);
                          return;
                        }
                        setActiveMoodGroup(group.group);
                      }}
                      type="button"
                    >
                      <span>{group.label}</span>
                      <small>{isOpen && selectedInGroup ? `已选：${selectedMood}` : group.hint}</small>
                    </button>
                    <div className="level-panel">
                      {levels.map((mood) => (
                        <button
                          className={isOpen && selectedMood === mood.label ? 'level-button active' : 'level-button'}
                          key={mood.label}
                          onClick={(event) => {
                            setSelectedMood(mood.label);
                            setPinnedMoodGroup(mood.group);
                            setActiveMoodGroup(null);
                            event.currentTarget.blur();
                          }}
                          type="button"
                        >
                          <strong>
                            {mood.label}
                            {isOpen && selectedMood === mood.label && <span className="current-mark">当前</span>}
                          </strong>
                          <small>{mood.note}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
            <label>
              补充文字
              <textarea value={moodText} onChange={(event) => setMoodText(event.target.value)} placeholder="发生了什么？身体感觉怎样？有没有诱因？" />
            </label>
            <label>
              图片/视频
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={selectMedia}
              />
              {mediaName && <span className="file-name">{mediaName}</span>}
              {mediaDataUrl && mediaType.startsWith('image/') && (
                <img alt="待保存的图片预览" className="media-preview" src={mediaDataUrl} />
              )}
              {mediaPreviewUrl && mediaType.startsWith('video/') && (
                <video className="media-preview" controls playsInline preload="metadata" src={mediaPreviewUrl} />
              )}
            </label>
            <div className="form-actions">
              <span aria-live="polite" className={saveNotice && !saveNotice.includes('身体') ? 'save-notice show' : 'save-notice'} role="status">
                {!saveNotice.includes('身体') ? saveNotice : ''}
              </span>
              <button type="submit">保存情绪</button>
            </div>
          </form>

          <form className="panel body-panel" onSubmit={addBody}>
            <div className="panel-title">
              <span>身体与经期</span>
            </div>
            <label>
              日期
              <input type="date" value={bodyDate} onChange={(event) => setBodyDate(event.target.value)} />
            </label>
            <label>
              身体状态
              <textarea value={bodyText} onChange={(event) => setBodyText(event.target.value)} placeholder="例如：头痛、疲惫、腹痛、睡眠少、食欲变化..." />
            </label>
            <div className="toggle-row">
              <label className="check-card">
                <input type="checkbox" checked={periodStart} onChange={(event) => setPeriodStart(event.target.checked)} />
                经期开始
              </label>
              <label className="check-card">
                <input type="checkbox" checked={periodEnd} onChange={(event) => setPeriodEnd(event.target.checked)} />
                经期结束
              </label>
            </div>
            <div className="form-actions">
              <span aria-live="polite" className={saveNotice.includes('身体') ? 'save-notice show' : 'save-notice'} role="status">
                {saveNotice.includes('身体') ? saveNotice : ''}
              </span>
              <button type="submit">保存身体记录</button>
            </div>
          </form>
        </section>

        <section className="insight-grid">
          <div className="panel chart-panel">
            <div className="panel-title">
              <span>情绪趋势</span>
              <div className="segment">
                {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                  <button className={viewMode === mode ? 'selected' : ''} key={mode} onClick={() => setViewMode(mode)} type="button">
                    {mode === 'day' ? '日' : mode === 'week' ? '周' : '月'}
                  </button>
                ))}
              </div>
            </div>
            <div className="trend-toolbar">
              <button onClick={() => shiftTrendRange(-1)} type="button">上一段</button>
              <label>
                参考日期
                <input type="date" value={trendDate} onChange={(event) => setTrendDate(event.target.value)} />
              </label>
              <button onClick={() => setTrendDate(today)} type="button">今天</button>
              <button onClick={() => shiftTrendRange(1)} type="button">下一段</button>
            </div>
            <p className="range-label">{trendRangeLabel}</p>
            <div className="chart-wrap">
              <svg className="trend-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="情绪趋势折线图">
                <line x1="0" x2={chartWidth} y1="105" y2="105" stroke="#d7cec0" strokeWidth="2" />
                <line x1="0" x2={chartWidth} y1="21" y2="21" stroke="#eadfce" strokeWidth="1" />
                <line x1="0" x2={chartWidth} y1="189" y2="189" stroke="#eadfce" strokeWidth="1" />
                {points && <polyline points={points} fill="none" stroke="#4f746d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                {chartPoints.map((point, index) => {
                  const x = chartPoints.length === 1 ? chartWidth / 2 : (index / (chartPoints.length - 1)) * chartWidth;
                  const y = moodScoreToY(point.average);
                  const style = chartPointStyle(point);
                  return (
                    <circle
                      cx={x}
                      cy={y}
                      fill={style.fill}
                      key={point.key}
                      r={style.radius}
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                    />
                  );
                })}
              </svg>
              {!chartPoints.length && <div className="empty-chart">暂无记录</div>}
            </div>
            <div className="chart-labels">
              {visibleChartLabels.map((point) => (
                <span key={point.key}>{point.label}</span>
              ))}
            </div>
            <div className="legend-row">
              <span>上方代表高兴/兴奋</span>
              <span>中线代表平静/麻木，点越深麻木越重</span>
              <span>下方代表难过</span>
            </div>
          </div>

          <aside className="panel ai-panel">
            <div className="panel-title">
              <span>AI 小结</span>
              <span className="soft-tag">非诊断</span>
            </div>
            <p>{aiSummary}</p>
            <label>
              模型配置
              <input value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="例如 OpenAI / 本地模型 / 自定义 API" />
            </label>
            <div className="chat-box">
              <p>你可以问：“最近兴奋和经期有没有关系？”</p>
              <button type="button">对话窗口占位</button>
            </div>
          </aside>
        </section>

        <section className="panel timeline-panel">
          <div className="panel-title">
            <span>记录时间线</span>
            <div className="segment">
              {(['combined', 'mood', 'body'] as TimelineMode[]).map((mode) => (
                <button className={timelineMode === mode ? 'selected' : ''} key={mode} onClick={() => setTimelineMode(mode)} type="button">
                  {mode === 'combined' ? '合并' : mode === 'mood' ? '情绪' : '身体'}
                </button>
              ))}
            </div>
          </div>
          <div className="timeline-toolbar">
            <button onClick={() => shiftTimelineDate(-1)} type="button">前一天</button>
            <label>
              查看日期
              <input type="date" value={timelineDate} onChange={(event) => setTimelineDate(event.target.value)} />
            </label>
            <button onClick={() => setTimelineDate(today)} type="button">今天</button>
            <button onClick={() => shiftTimelineDate(1)} type="button">后一天</button>
          </div>
          <p className="range-label">{timelineDate}</p>
          <div className="timeline-list">
            {timelineItems.map((item) => {
              if (item.kind === 'mood') {
                const mood = getMood(item.entry.mood);
                return (
                  <article className="timeline-item" key={item.entry.id} style={{ '--mood-color': mood.color } as React.CSSProperties}>
                    <span className="dot" />
                    <div>
                      <div className="timeline-heading">
                        <div>
                          <time>{item.entry.date} {item.entry.time}</time>
                          <h3>{mood.groupLabel} · {item.entry.mood}</h3>
                        </div>
                        <button aria-label="删除这条情绪记录" onClick={() => deleteMood(item.entry.id)} type="button">
                          删除
                        </button>
                      </div>
                      <p>{item.entry.text || mood.note}</p>
                      {item.entry.mediaDataUrl && item.entry.mediaType?.startsWith('image/') && (
                        <img alt={item.entry.mediaName || '情绪记录图片'} className="timeline-media" src={item.entry.mediaDataUrl} />
                      )}
                      {(item.entry.mediaDataUrl || mediaUrls[item.entry.id]) && item.entry.mediaType?.startsWith('video/') && (
                        <video
                          className="timeline-media"
                          controls
                          onError={() => setMediaLoadErrors((errors) => ({ ...errors, [item.entry.id]: true }))}
                          playsInline
                          preload="metadata"
                          src={item.entry.mediaDataUrl || mediaUrls[item.entry.id]}
                        >
                          <source src={item.entry.mediaDataUrl || mediaUrls[item.entry.id]} type={item.entry.mediaType || 'video/mp4'} />
                        </video>
                      )}
                      {item.entry.mediaName && mediaLoadErrors[item.entry.id] && (
                        <small>视频暂时无法在当前手机浏览器内播放，可以换系统浏览器或重新上传较常见的 MP4 视频。</small>
                      )}
                      {item.entry.mediaName && !item.entry.mediaDataUrl && !mediaUrls[item.entry.id] && <small>{item.entry.mediaName}</small>}
                    </div>
                  </article>
                );
              }
              return (
                <article className="timeline-item body-item" key={item.entry.id}>
                  <span className="dot" />
                  <div>
                    <div className="timeline-heading">
                      <div>
                        <time>{item.entry.date}</time>
                        <h3>身体记录{item.entry.periodStart ? ' · 经期开始' : ''}{item.entry.periodEnd ? ' · 经期结束' : ''}</h3>
                      </div>
                      <button aria-label="删除这条身体记录" onClick={() => deleteBody(item.entry.id)} type="button">
                        删除
                      </button>
                    </div>
                    <p>{item.entry.text}</p>
                  </div>
                </article>
              );
            })}
            {!timelineItems.length && (
              <div className="empty-timeline">这一天暂无记录，可以切换日期查看。</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
