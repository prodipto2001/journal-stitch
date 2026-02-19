"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type MemoryEntry = {
  id: number;
  title: string;
  content: string;
  dateLabel: string;
  badges: Array<{ label: string; icon: string; tone: string }>;
  images?: Array<{ src: string }>;
  notes?: Array<{ text: string; x: number; y: number }>;
  sticker?: { label: string; icon: string; tone: string; tilt: string };
};

type PlacedImage = {
  id: number;
  src: string;
  x: number;
  y: number;
  width: number;
};

type StickyNote = {
  id: number;
  text: string;
  x: number;
  y: number;
  width: number;
};

type UserGender = "male" | "female" | "other";

type UserProfile = {
  name: string;
  gender: UserGender;
};

type WeatherInfo = {
  label: string;
  tempC: number;
  icon: string;
};

const moodStickers = [
  { title: "Happy", icon: "sentiment_very_satisfied", token: "\u{1F600}", tone: "bg-yellow-50 hover:bg-yellow-100 text-yellow-500" },
  { title: "Calm", icon: "spa", token: "\u{1F9D8}", tone: "bg-blue-50 hover:bg-blue-100 text-blue-500" },
  { title: "Stressed", icon: "sentiment_stressed", token: "\u{1F62E}\u200D\u{1F4A8}", tone: "bg-red-50 hover:bg-red-100 text-red-500" },
  { title: "Sleepy", icon: "bedtime", token: "\u{1F634}", tone: "bg-purple-50 hover:bg-purple-100 text-purple-500" },
] as const;

const activities = [
  { label: "Gym", icon: "fitness_center", token: "#Gym", tone: "text-orange-500" },
  { label: "Reading", icon: "book", token: "#Reading", tone: "text-sky-500" },
  { label: "Foodie", icon: "restaurant", token: "#Foodie", tone: "text-emerald-500" },
  { label: "Movie", icon: "movie", token: "#Movie", tone: "text-pink-500" },
] as const;

const decorative = [
  { icon: "star", token: "\u2728", tone: "from-indigo-100 to-purple-100 text-indigo-400" },
  { icon: "eco", token: "\u{1F33F}", tone: "from-green-100 to-teal-100 text-teal-500" },
  { icon: "bolt", token: "\u26A1", tone: "from-orange-100 to-amber-100 text-orange-400" },
] as const;

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseDateLabel(dateLabel: string) {
  const parsed = new Date(dateLabel);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getGreetingPrefix(date: Date) {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

function getAvatarStyle(gender: UserGender) {
  if (gender === "male") {
    return "from-sky-500 to-indigo-600";
  }
  if (gender === "female") {
    return "from-pink-500 to-rose-500";
  }
  return "from-emerald-500 to-teal-600";
}

function weatherCodeToUI(code: number): { label: string; icon: string } {
  if (code === 0) {
    return { label: "Clear", icon: "sunny" };
  }
  if (code === 1 || code === 2 || code === 3) {
    return { label: "Cloudy", icon: "partly_cloudy_day" };
  }
  if (code === 45 || code === 48) {
    return { label: "Fog", icon: "foggy" };
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) {
    return { label: "Rain", icon: "rainy" };
  }
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: "Snow", icon: "ac_unit" };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: "Storm", icon: "thunderstorm" };
  }
  return { label: "Weather", icon: "wb_cloudy" };
}

function readStoredProfile(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed?.name || !parsed?.gender) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readStoredEntries(storageKey: string) {
  if (typeof window === "undefined") {
    return [] as MemoryEntry[];
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return [] as MemoryEntry[];
  }
  if (!raw) {
    return [] as MemoryEntry[];
  }
  try {
    const parsed = JSON.parse(raw) as MemoryEntry[];
    if (!Array.isArray(parsed)) {
      return [] as MemoryEntry[];
    }
    return parsed
      .filter((entry) => entry && typeof entry.id === "number")
      .map((entry) => ({
        ...entry,
        badges: Array.isArray(entry.badges) ? entry.badges : [],
      }));
  } catch {
    return [] as MemoryEntry[];
  }
}

function getScannedTitle(text: string) {
  const firstLine =
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (!firstLine) {
    return "Scanned Memory";
  }
  return firstLine.length > 64 ? `${firstLine.slice(0, 64).trim()}...` : firstLine;
}

function buildScannedTemplate(rawText: string) {
  const cleanedText = rawText
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const lines = cleanedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const summary = lines.slice(0, 2).join(" ");
  const highlights = lines.slice(0, 5);

  const content = [
    "SCANNED JOURNAL",
    "",
    "Summary:",
    summary || "No clear summary detected from the image.",
    "",
    "Highlights:",
    ...(highlights.length > 0
      ? highlights.map((line) => `- ${line}`)
      : ["- No highlights detected."]),
    "",
    "Extracted Text:",
    cleanedText || "No readable text found in this image.",
  ].join("\n");

  return {
    title: getScannedTitle(cleanedText),
    content,
  };
}

export default function Home() {
  const now = new Date();
  const storageKey = "sticker_journal_profile_v1";
  const entriesStorageKey = "sticker_journal_entries_v1";
  const inputRef = useRef<HTMLInputElement>(null);
  const scanUploadInputRef = useRef<HTMLInputElement>(null);
  const scanCameraInputRef = useRef<HTMLInputElement>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const noteDragOffsetRef = useRef({ x: 0, y: 0 });
  const calendarMenuRef = useRef<HTMLDivElement>(null);
  const scanMenuRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<MemoryEntry[]>(() => readStoredEntries(entriesStorageKey));
  const [mood, setMood] = useState("Feeling Good");
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [draggingImageId, setDraggingImageId] = useState<number | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<number | null>(null);
  const [openEntry, setOpenEntry] = useState<MemoryEntry | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scanMenuOpen, setScanMenuOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => readStoredProfile(storageKey) === null);
  const [nameInput, setNameInput] = useState("");
  const [genderInput, setGenderInput] = useState<UserGender>("other");
  const [profile, setProfile] = useState<UserProfile | null>(() => readStoredProfile(storageKey));
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [showStickerTooltip, setShowStickerTooltip] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const entryDate = parseDateLabel(entry.dateLabel);
      const matchesDate = selectedDateKey
        ? entryDate !== null && toDateKey(entryDate) === selectedDateKey
        : true;
      if (!matchesDate) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        entry.title.toLowerCase().includes(normalized) ||
        entry.content.toLowerCase().includes(normalized) ||
        entry.badges.some((badge) => badge.label.toLowerCase().includes(normalized))
      );
    });
  }, [entries, query, selectedDateKey]);

  const entryDates = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((entry) => {
      const parsed = parseDateLabel(entry.dateLabel);
      if (!parsed) {
        return;
      }
      const key = toDateKey(parsed);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [entries]);

  const monthGrid = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string; label: number; dateKey: string }> = [];

    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ key: `blank-${i}`, label: 0, dateKey: "" });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      cells.push({ key: `day-${day}`, label: day, dateKey: toDateKey(date) });
    }
    return cells;
  }, [calendarMonth]);

  const appendToken = (token: string) => {
    setContent((prev) => {
      const spacer = prev.endsWith("\n") || prev.length === 0 ? "" : " ";
      return `${prev}${spacer}${token}`;
    });
  };

  const resetComposer = () => {
    setTitle("");
    setContent("");
    setPlacedImages([]);
    setStickyNotes([]);
  };

  useEffect(() => {
    if (draggingImageId === null) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      setPlacedImages((prev) => {
        const active = prev.find((image) => image.id === draggingImageId);
        if (!active) {
          return prev;
        }

        const rect = canvas.getBoundingClientRect();
        const imageHeight = Math.round(active.width * 0.75);
        const nextX = Math.min(
          Math.max(event.clientX - rect.left - dragOffsetRef.current.x, 0),
          Math.max(rect.width - active.width, 0),
        );
        const nextY = Math.min(
          Math.max(event.clientY - rect.top - dragOffsetRef.current.y, 0),
          Math.max(rect.height - imageHeight, 0),
        );

        return prev.map((image) =>
          image.id === draggingImageId ? { ...image, x: nextX, y: nextY } : image,
        );
      });
    };

    const onPointerUp = () => {
      setDraggingImageId(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingImageId]);

  useEffect(() => {
    if (draggingNoteId === null) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      setStickyNotes((prev) => {
        const active = prev.find((note) => note.id === draggingNoteId);
        if (!active) {
          return prev;
        }

        const rect = canvas.getBoundingClientRect();
        const noteHeight = 136;
        const nextX = Math.min(
          Math.max(event.clientX - rect.left - noteDragOffsetRef.current.x, 0),
          Math.max(rect.width - active.width, 0),
        );
        const nextY = Math.min(
          Math.max(event.clientY - rect.top - noteDragOffsetRef.current.y, 0),
          Math.max(rect.height - noteHeight, 0),
        );

        return prev.map((note) =>
          note.id === draggingNoteId ? { ...note, x: nextX, y: nextY } : note,
        );
      });
    };

    const onPointerUp = () => {
      setDraggingNoteId(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingNoteId]);

  useEffect(() => {
    if (!calendarOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!calendarMenuRef.current) {
        return;
      }
      if (!calendarMenuRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [calendarOpen]);

  useEffect(() => {
    if (!scanMenuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!scanMenuRef.current) {
        return;
      }
      if (!scanMenuRef.current.contains(event.target as Node)) {
        setScanMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [scanMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(entriesStorageKey, JSON.stringify(entries));
    } catch {
      // Ignore storage failures on restricted mobile browsers.
    }
  }, [entries, entriesStorageKey]);

  useEffect(() => {
    const loadWeather = async (lat: number, lon: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`,
        );
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        if (
          typeof data.current?.temperature_2m !== "number" ||
          typeof data.current?.weather_code !== "number"
        ) {
          return;
        }
        const mapped = weatherCodeToUI(data.current.weather_code);
        setWeather({
          label: mapped.label,
          tempC: Math.round(data.current.temperature_2m),
          icon: mapped.icon,
        });
      } catch {
        // Keep fallback text if weather request fails.
      }
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void loadWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          void loadWeather(40.7128, -74.006);
        },
        { timeout: 5000 },
      );
      return;
    }

    void loadWeather(40.7128, -74.006);
  }, []);

  const saveProfile = () => {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      return;
    }
    const nextProfile: UserProfile = {
      name: trimmedName,
      gender: genderInput,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextProfile));
    } catch {
      // Ignore storage failures on restricted mobile browsers.
    }
    setProfile(nextProfile);
    setShowOnboarding(false);
  };

  const createScannedEntry = (rawText: string, imageSrc: string) => {
    const template = buildScannedTemplate(rawText);
    const entryDate = new Date();
    const newEntry: MemoryEntry = {
      id: entryDate.getTime(),
      title: template.title,
      content: template.content,
      dateLabel: formatDateLabel(entryDate),
      images: imageSrc ? [{ src: imageSrc }] : undefined,
      badges: [
        { label: "Scanned", icon: "document_scanner", tone: "bg-violet-50 text-violet-700 border border-violet-200/80" },
        { label: "Journal", icon: "auto_stories", tone: "bg-slate-100 text-slate-700 border border-slate-200/90" },
      ],
      sticker: {
        label: "Auto",
        icon: "auto_awesome",
        tone: "bg-cyan-100 text-cyan-700",
        tilt: "-rotate-2",
      },
    };
    setEntries((prev) => [newEntry, ...prev]);
    setQuery("");
  };

  const saveOpenEntryEdits = () => {
    if (!openEntry) {
      return;
    }
    const nextTitle = editingTitle.trim() || "Untitled memory";
    const nextContent = editingContent.trim() || "No notes added.";

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === openEntry.id
          ? {
              ...entry,
              title: nextTitle,
              content: nextContent,
            }
          : entry,
      ),
    );
    setOpenEntry((prev) =>
      prev && prev.id === openEntry.id
        ? {
            ...prev,
            title: nextTitle,
            content: nextContent,
          }
        : prev,
    );
    setIsEditingEntry(false);
  };

  const openEntryModal = (entry: MemoryEntry) => {
    setOpenEntry(entry);
    setIsEditingEntry(false);
    setEditingTitle(entry.title);
    setEditingContent(entry.content);
  };

  const closeOpenEntryModal = () => {
    setOpenEntry(null);
    setIsEditingEntry(false);
  };

  const scanImageAndSave = async (imageSrc: string) => {
    const parsed = imageSrc.match(/^data:(.*?);base64,(.*)$/);
    if (!parsed) {
      setScanDialogOpen(true);
      setScanBusy(false);
      setScanStatus("Only local uploaded images can be scanned.");
      return;
    }
    const mimeType = parsed[1];
    const base64 = parsed[2];
    setScanDialogOpen(true);
    setScanBusy(true);
    setScanStatus("Scanning image...");
    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType, base64 }),
      });
      if (!response.ok) {
        const failure = (await response.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
        };
        setScanBusy(false);
        setScanStatus(failure.error ?? "Gemini OCR failed.");
        return;
      }
      const payload = (await response.json()) as { text?: string };
      setScanStatus("Creating journal entry...");
      createScannedEntry(payload.text ?? "", imageSrc);
      setScanBusy(false);
      setScanStatus("Scanned and saved.");
      window.setTimeout(() => {
        setScanDialogOpen(false);
        setScanStatus("");
      }, 1800);
    } catch {
      setScanBusy(false);
      setScanStatus("Could not scan this image.");
    }
  };

  const scanFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setScanDialogOpen(true);
    setScanBusy(true);
    setScanStatus("Preparing image...");

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        if (typeof src !== "string") {
          return;
        }
        void scanImageAndSave(src);
      };
      reader.readAsDataURL(file);
    });
  };

  const startImageDrag = (event: React.PointerEvent<HTMLDivElement>, imageId: number) => {
    const targetRect = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - targetRect.left,
      y: event.clientY - targetRect.top,
    };
    setDraggingImageId(imageId);
  };

  const addStickyNote = () => {
    const offset = stickyNotes.length * 14;
    setStickyNotes((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: "New sticky note...",
        x: 26 + offset,
        y: 84 + offset,
        width: 180,
      },
    ]);
  };

  const updateStickyNoteText = (id: number, text: string) => {
    setStickyNotes((prev) => prev.map((note) => (note.id === id ? { ...note, text } : note)));
  };

  const startNoteDrag = (event: React.PointerEvent<HTMLDivElement>, noteId: number) => {
    const targetRect = event.currentTarget.getBoundingClientRect();
    noteDragOffsetRef.current = {
      x: event.clientX - targetRect.left,
      y: event.clientY - targetRect.top,
    };
    setDraggingNoteId(noteId);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle && !trimmedContent && placedImages.length === 0 && stickyNotes.length === 0) {
      return;
    }

    const entryDate = new Date();
    const newEntry: MemoryEntry = {
      id: Date.now(),
      title: trimmedTitle || "Untitled memory",
      content: trimmedContent || "No notes added.",
      dateLabel: formatDateLabel(entryDate),
      images: placedImages.map((image) => ({ src: image.src })),
      notes: stickyNotes
        .map((note) => ({ text: note.text.trim(), x: note.x, y: note.y }))
        .filter((note) => note.text.length > 0),
      badges: [
        { label: mood.replace("Feeling ", "") || "Mood", icon: "mood", tone: "bg-blue-50 text-blue-700 border border-blue-200/80" },
        { label: "Journal", icon: "auto_stories", tone: "bg-slate-100 text-slate-700 border border-slate-200/90" },
      ],
      sticker: {
        label: "New",
        icon: "fiber_new",
        tone: "bg-emerald-100 text-emerald-700",
        tilt: "rotate-3",
      },
    };

    setEntries((prev) => [newEntry, ...prev]);
    setQuery("");
    resetComposer();
  };

  const canSaveEntry = Boolean(
    title.trim() || content.trim() || placedImages.length > 0 || stickyNotes.length > 0,
  );

  const submitEntry = () => {
    composerFormRef.current?.requestSubmit();
  };

  return (
    <div className="bg-background-light text-slate-900 overflow-x-hidden min-h-screen xl:h-screen xl:overflow-hidden flex flex-col relative">
      <div className="pointer-events-none absolute -top-14 -left-12 size-48 rounded-full bg-pink-200/40 blur-2xl" />
      <div className="pointer-events-none absolute top-24 -right-10 size-44 rounded-full bg-amber-200/40 blur-2xl" />
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-sky-100/80">
        <div className="max-w-[1440px] mx-auto px-5 md:px-6 h-20 md:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-900 group cursor-pointer min-w-0">
            <div className="size-9 text-primary rounded-full bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">auto_stories</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold tracking-tight text-sky-700 leading-tight">StickerJournal</h2>
              <p className="hidden md:block text-xs text-slate-500 truncate">
                {getGreetingPrefix(now)}, {profile?.name ?? "Friend"}. Ready to capture today&apos;s memories?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="hidden md:flex items-center gap-2 border border-slate-200 rounded-full px-3 h-10 bg-white min-w-[260px]">
              <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
              <input
                className="w-full text-sm text-slate-700 placeholder:text-slate-400 border-none p-0 bg-transparent focus:ring-0 focus:outline-none"
                placeholder="Search entries"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div ref={scanMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setScanMenuOpen((prev) => !prev)}
                className="h-10 px-3 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-blue-200 text-sm font-semibold transition-colors inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                Scan
              </button>
              {scanMenuOpen ? (
                <div className="absolute right-0 top-full z-[70] mt-3 w-52 rounded-2xl border border-sky-100 bg-white p-2.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setScanMenuOpen(false);
                      scanUploadInputRef.current?.click();
                    }}
                    className="w-full h-10 px-3 rounded-xl text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px] text-blue-600">upload</span>
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanMenuOpen(false);
                      scanCameraInputRef.current?.click();
                    }}
                    className="mt-1 w-full h-10 px-3 rounded-xl text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px] text-violet-600">photo_camera</span>
                    Click Image
                  </button>
                </div>
              ) : null}
            </div>
            <div ref={calendarMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setCalendarOpen((prev) => !prev)}
                className="h-10 px-3 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-blue-200 text-sm font-semibold transition-colors inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                Calendar
              </button>
              {calendarOpen ? (
                <div className="absolute right-0 top-full z-[70] mt-3 w-[340px] rounded-2xl border border-sky-100 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                        )
                      }
                      className="size-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Previous month"
                    >
                      <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <h3 className="text-sm font-bold text-slate-800">
                      {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                        )
                      }
                      className="size-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                      aria-label="Next month"
                    >
                      <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2 text-[11px] font-semibold text-slate-400 uppercase">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <span key={day} className="h-7 flex items-center justify-center">
                        {day}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {monthGrid.map((cell) => {
                      if (!cell.dateKey) {
                        return <span key={cell.key} className="h-9" />;
                      }
                      const hasEntries = entryDates.has(cell.dateKey);
                      const isSelected = selectedDateKey === cell.dateKey;
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() =>
                            setSelectedDateKey((prev) => (prev === cell.dateKey ? null : cell.dateKey))
                          }
                          className={`h-9 rounded-lg text-sm font-semibold relative transition-colors ${
                            isSelected
                              ? "bg-primary text-white"
                              : hasEntries
                                ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : "text-slate-600 hover:bg-slate-50"
                          }`}
                          title={
                            hasEntries
                              ? `${entryDates.get(cell.dateKey)} journal(s)`
                              : "No journals on this date"
                          }
                        >
                          {cell.label}
                          {hasEntries && !isSelected ? (
                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-blue-500" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {selectedDateKey
                        ? `Filtering by ${new Date(selectedDateKey).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}`
                        : "Select a date to filter journals"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedDateKey(null)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {scanStatus ? (
              <span className="hidden xl:inline-flex text-xs font-semibold text-slate-500 whitespace-nowrap">
                {scanStatus}
              </span>
            ) : null}
            <div
              className={`h-9 w-9 rounded-full overflow-hidden ring-2 ring-white cursor-pointer relative bg-gradient-to-br ${getAvatarStyle(profile?.gender ?? "other")} text-white text-xs font-bold flex items-center justify-center`}
              title={profile?.name ?? "Guest"}
            >
              {(profile?.name?.[0] ?? "G").toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col xl:flex-row max-w-[1440px] mx-auto w-full p-4 md:p-6 gap-6 overflow-x-hidden xl:h-[calc(100vh-5rem)] xl:min-h-0 xl:overflow-hidden">
        <section className="flex-1 min-w-0 flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto hide-scrollbar">
          <form
            ref={composerFormRef}
            onSubmit={handleSubmit}
            className="w-full bg-white/95 rounded-3xl shadow-paper border border-sky-100 relative overflow-visible group transition-all duration-300 hover:shadow-hover playful-grid xl:h-full"
          >
            <div className="absolute top-3 right-3 z-10 rotate-12 transform hover:scale-110 transition-transform cursor-pointer">
              <div className="bg-yellow-100 text-yellow-600 p-2 rounded-xl border-2 border-white flex flex-col items-center wobble-hover">
                <span className="material-symbols-outlined text-3xl">sunny</span>
              </div>
            </div>
            <div className="p-6 md:p-8 lg:p-10 flex flex-col gap-6 h-full">
              <div className="flex items-center justify-between text-slate-400 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  {formatLongDate(now)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  {formatTime(now)}
                </span>
              </div>
              <div
                ref={canvasRef}
                className="relative z-0 min-h-[340px] xl:min-h-[460px] rounded-2xl border border-transparent px-4 py-3 transition-all overflow-visible"
              >
                <div className="relative z-10">
                  <input
                    ref={inputRef}
                    className="w-full text-3xl font-bold text-slate-900 placeholder:text-slate-300 border-none focus:ring-0 focus:outline-none p-0 bg-transparent rounded-lg"
                    placeholder="Title of your entry..."
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  <textarea
                    className="w-full min-h-[260px] xl:min-h-[360px] resize-none text-lg text-slate-600 placeholder:text-slate-300 border-none focus:ring-0 focus:outline-none p-0 bg-transparent leading-relaxed mt-6 rounded-lg"
                    placeholder="Start writing about your day here... What made you smile?"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                </div>

                <div className="absolute inset-0 z-20 pointer-events-none">
                  {placedImages.map((image) => (
                    <div
                      key={image.id}
                      onPointerDown={(event) => startImageDrag(event, image.id)}
                      className="absolute pointer-events-auto group cursor-grab active:cursor-grabbing touch-none"
                      style={{ left: image.x, top: image.y, width: image.width }}
                    >
                      <img
                        src={image.src}
                        alt="Inserted memory"
                        className="w-full aspect-[4/3] object-cover rounded-xl border-2 border-white shadow-lg"
                        draggable={false}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPlacedImages((prev) => prev.filter((item) => item.id !== image.id))
                        }
                        className="absolute -top-2 -right-2 size-6 rounded-full bg-slate-900 text-white text-xs hidden group-hover:flex items-center justify-center"
                        aria-label="Remove image"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  {stickyNotes.map((note) => (
                    <div
                      key={note.id}
                      className="absolute pointer-events-auto rounded-xl border border-yellow-200 bg-yellow-100/95 shadow-sm"
                      style={{ left: note.x, top: note.y, width: note.width }}
                    >
                      <div
                        onPointerDown={(event) => startNoteDrag(event, note.id)}
                        className="h-6 rounded-t-xl bg-yellow-200/80 cursor-grab active:cursor-grabbing flex items-center justify-between px-2"
                      >
                        <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wide">Note</span>
                        <button
                          type="button"
                          onClick={() =>
                            setStickyNotes((prev) => prev.filter((item) => item.id !== note.id))
                          }
                          className="text-[10px] text-yellow-700 hover:text-yellow-900"
                          aria-label="Remove sticky note"
                        >
                          x
                        </button>
                      </div>
                      <textarea
                        value={note.text}
                        onChange={(event) => updateStickyNoteText(note.id, event.target.value)}
                        className="w-full h-[110px] resize-none bg-transparent border-none focus:ring-0 focus:outline-none p-2 text-xs text-yellow-900 leading-snug"
                      />
                    </div>
                  ))}
                </div>

                <div className="absolute z-40 bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[620px] pointer-events-auto">
                  <div className="w-full relative" onMouseLeave={() => setShowStickerTooltip(false)}>
                    {showStickerTooltip ? (
                      <div className="absolute bottom-[calc(100%+10px)] left-0 right-0 rounded-2xl border border-slate-200 bg-white/98 px-3 py-2 shadow-lg z-50">
                        <div className="flex flex-wrap items-center gap-2">
                          {moodStickers.map((sticker) => (
                            <button
                              key={sticker.title}
                              type="button"
                              onClick={() => {
                                setMood(`Feeling ${sticker.title}`);
                                appendToken(sticker.token);
                              }}
                              className={`size-8 rounded-lg ${sticker.tone} inline-flex items-center justify-center`}
                              title={sticker.title}
                            >
                              <span className="material-symbols-outlined text-[17px]">{sticker.icon}</span>
                            </button>
                          ))}
                          {activities.map((activity) => (
                            <button
                              key={activity.label}
                              type="button"
                              onClick={() => appendToken(activity.token)}
                              className="h-8 px-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold inline-flex items-center gap-1"
                              title={activity.label}
                            >
                              <span className={`material-symbols-outlined text-[14px] ${activity.tone}`}>{activity.icon}</span>
                              {activity.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={addStickyNote}
                            className="h-8 px-2 rounded-lg bg-yellow-100 border border-yellow-200 text-yellow-800 text-xs font-semibold inline-flex items-center gap-1"
                            title="Add Sticky Note"
                          >
                            <span className="material-symbols-outlined text-[14px]">sticky_note_2</span>
                            Note
                          </button>
                          {decorative.map((item, index) => (
                            <button
                              key={item.icon}
                              type="button"
                              onClick={() => appendToken(item.token)}
                              className={`size-8 rounded-lg bg-gradient-to-br ${item.tone} inline-flex items-center justify-center`}
                              title={`Decoration ${index + 1}`}
                            >
                              <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={addStickyNote}
                          className="size-9 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
                          title="Add Sticky Note"
                        >
                          <span className="material-symbols-outlined text-[18px]">sticky_note_2</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => appendToken("??")}
                          className="size-9 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
                          title="Add Location"
                        >
                          <span className="material-symbols-outlined text-[18px]">location_on</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => appendToken("**highlight**")}
                          className="size-9 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
                          title="Text Formatting"
                        >
                          <span className="material-symbols-outlined text-[18px]">format_size</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onMouseEnter={() => setShowStickerTooltip(true)}
                          onClick={() => setShowStickerTooltip((prev) => !prev)}
                          className={`size-10 rounded-xl inline-flex items-center justify-center ${showStickerTooltip ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700 hover:bg-violet-200"}`}
                          title="More stickers"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={submitEntry}
                          disabled={!canSaveEntry}
                          className="h-10 px-4 rounded-xl inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Save Entry"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>

        <aside className="w-full xl:w-[430px] 2xl:w-[460px] shrink-0 flex flex-col gap-4 xl:min-h-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm flex flex-col items-center justify-center gap-2 text-center hover:border-orange-200 transition-colors cursor-pointer group">
              <span className="material-symbols-outlined text-3xl text-orange-400 group-hover:scale-110 transition-transform">
                {weather?.icon ?? "sunny"}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weather</span>
              <span className="text-sm font-bold text-slate-900">
                {weather ? `${weather.label}, ${weather.tempC} deg` : "Loading..."}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col items-center justify-center gap-2 text-center hover:border-rose-200 transition-colors cursor-pointer group">
              <span className="material-symbols-outlined text-3xl text-rose-400 group-hover:scale-110 transition-transform">sentiment_satisfied</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mood</span>
              <span className="text-sm font-bold text-slate-900">{mood}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-sky-100 bg-white/95 shadow-paper p-4 xl:flex-1 xl:min-h-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-slate-900">Past Memories ({filteredEntries.length})</h3>
                {selectedDateKey ? (
                  <button
                    type="button"
                    onClick={() => setSelectedDateKey(null)}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  >
                    {new Date(selectedDateKey).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:flex-1 xl:min-h-0 overflow-y-auto hide-scrollbar px-1 pt-3 pb-1">
              {filteredEntries.map((entry) => (
                <article
                  key={entry.id}
                  onClick={() => openEntryModal(entry)}
                  className="bg-white rounded-2xl border border-sky-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer relative group"
                >
                  {entry.sticker ? (
                    <div
                      className={`absolute -top-3 -right-2 transform ${entry.sticker.tilt} ${entry.sticker.tone} px-2 py-1 rounded shadow-sm border border-white text-xs font-bold z-10`}
                    >
                      <span className="material-symbols-outlined text-sm align-middle mr-1">{entry.sticker.icon}</span>
                      {entry.sticker.label}
                    </div>
                  ) : null}
                  <div className="text-slate-400 text-xs font-semibold mb-3">{entry.dateLabel}</div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 leading-tight group-hover:text-primary transition-colors">{entry.title}</h4>
                  <p className="text-slate-500 text-sm line-clamp-3 mb-4">{entry.content}</p>
                  <div className="flex gap-2 flex-wrap">
                    {entry.badges.map((badge) => (
                      <span
                        key={`${entry.id}-${badge.label}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badge.tone} text-[11px] font-semibold tracking-wide shadow-[0_1px_2px_rgba(15,23,42,0.06)]`}
                      >
                        <span className="material-symbols-outlined text-[13px] leading-none">{badge.icon}</span>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No journals found for the current search/date filter.</p>
            ) : null}
          </div>
        </aside>
      </main>

      {showOnboarding ? (
        <div className="fixed inset-0 z-[90] bg-slate-900/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-100 shadow-xl p-6">
            <h3 className="text-2xl font-extrabold text-slate-900">Welcome to StickerJournal</h3>
            <p className="text-sm text-slate-500 mt-2">
              First time here. Please tell us your name and gender.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Your Name</span>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="Enter your name"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Gender</span>
                <select
                  value={genderInput}
                  onChange={(event) => setGenderInput(event.target.value as UserGender)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={saveProfile}
              disabled={!nameInput.trim()}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      <input
        ref={scanUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          scanFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={scanCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          scanFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {scanDialogOpen ? (
        <div className="fixed inset-0 z-[95] bg-slate-900/35 p-4 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-sky-100 bg-white shadow-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {scanBusy ? (
                  <span className="mt-0.5 size-5 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-xl text-blue-600">task_alt</span>
                )}
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">Image Scan Status</h4>
                  <p className="mt-1 text-sm text-slate-600">{scanStatus || "Starting..."}</p>
                </div>
              </div>
              {!scanBusy ? (
                <button
                  type="button"
                  onClick={() => setScanDialogOpen(false)}
                  className="size-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                  aria-label="Close scan status"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {openEntry ? (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/40 p-4 md:p-8 flex items-center justify-center"
          onClick={closeOpenEntryModal}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-100 shadow-xl p-6 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{openEntry.dateLabel}</p>
                {isEditingEntry ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    className="w-full text-2xl font-extrabold text-slate-900 leading-tight border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-0"
                  />
                ) : (
                  <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">{openEntry.title}</h3>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditingEntry ? (
                  <>
                    <button
                      type="button"
                      onClick={saveOpenEntryEdits}
                      className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTitle(openEntry.title);
                        setEditingContent(openEntry.content);
                        setIsEditingEntry(false);
                      }}
                      className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingEntry(true)}
                    className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeOpenEntryModal}
                  className="size-9 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  aria-label="Close journal"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              {openEntry.badges.map((badge) => (
                <span
                  key={`${openEntry.id}-${badge.label}-open`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badge.tone} text-[11px] font-semibold tracking-wide`}
                >
                  <span className="material-symbols-outlined text-[13px] leading-none">{badge.icon}</span>
                  {badge.label}
                </span>
              ))}
            </div>

            {openEntry.images && openEntry.images.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {openEntry.images.map((image, index) => (
                  <img
                    key={`${openEntry.id}-image-${index}`}
                    src={image.src}
                    alt={`Journal attachment ${index + 1}`}
                    className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200"
                  />
                ))}
              </div>
            ) : null}

            {openEntry.notes && openEntry.notes.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {openEntry.notes.map((note, index) => (
                  <div
                    key={`${openEntry.id}-note-${index}`}
                    className="rounded-xl border border-yellow-200 bg-yellow-100/80 p-3"
                  >
                    <p className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-1">Sticky Note</p>
                    <p className="text-sm text-yellow-900 whitespace-pre-wrap">{note.text}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {isEditingEntry ? (
              <textarea
                value={editingContent}
                onChange={(event) => setEditingContent(event.target.value)}
                className="mt-6 w-full min-h-[240px] rounded-xl border border-slate-200 p-3 text-slate-700 leading-relaxed whitespace-pre-wrap focus:outline-none focus:ring-0 resize-y"
              />
            ) : (
              <p className="mt-6 text-slate-700 leading-relaxed whitespace-pre-wrap">{openEntry.content}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}







