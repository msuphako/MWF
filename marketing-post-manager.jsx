// ============================================================
// Marketing Post Manager — React + Firebase
// Channels: LinkedIn, WordPress Blog
// AI: Claude API (swap CLAUDE_API_KEY) or OpenAI (see generateWithAI)
// Publishing: LinkedIn API + WordPress REST API
// ============================================================
// SETUP INSTRUCTIONS:
//  1. Create a Firebase project → enable Firestore
//  2. Fill in FIREBASE_CONFIG below
//  3. Fill in your API keys in the CONFIG section
//  4. For LinkedIn: create a LinkedIn app → get access token (OAuth2)
//  5. For WordPress: enable Application Passwords in WP settings
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── CONFIG — fill these in ───────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const CONFIG = {
  CLAUDE_API_KEY:        import.meta.env.VITE_CLAUDE_API_KEY,
  CLAUDE_MODEL:          import.meta.env.VITE_CLAUDE_MODEL ?? "claude-opus-4-6",
  OPENAI_API_KEY:        import.meta.env.VITE_OPENAI_API_KEY,
  OPENAI_MODEL:          import.meta.env.VITE_OPENAI_MODEL ?? "gpt-4o",
  LINKEDIN_ACCESS_TOKEN: import.meta.env.VITE_LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_PERSON_URN:   import.meta.env.VITE_LINKEDIN_PERSON_URN,
  WP_URL:                import.meta.env.VITE_WP_URL,
  WP_USERNAME:           import.meta.env.VITE_WP_USERNAME,
  WP_APP_PASSWORD:       import.meta.env.VITE_WP_APP_PASSWORD,
};
// ─────────────────────────────────────────────────────────────

// Init Firebase
let db;
let storage;
try {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (e) {
  console.warn("Firebase not initialised — using local state only:", e.message);
}

// ─── AI Generation ───────────────────────────────────────────
const SYSTEM_PROMPTS = {
  linkedin: `You are an expert LinkedIn content creator. Write engaging, professional LinkedIn posts.
Use line breaks for readability. Include 3-5 relevant hashtags at the end. Keep it under 3000 characters.
Focus on insights, storytelling, and professional value. Do NOT use markdown headers.
Return only the post text — no code fences, no extra commentary.`,
  wordpress: `You are an expert blog writer. Write a full, well-structured WordPress blog post in HTML.
Use <h2> and <h3> for headings, <p> for paragraphs, <ul>/<ol> for lists.
Include an engaging introduction, structured body sections, and a clear conclusion.
Aim for 600-1200 words. Make it SEO-friendly.
Return only the raw HTML — no code fences, no markdown, no extra commentary.`,
};

const TONES = [
  { id: "professional",  label: "Professional",  instruction: "Use a professional, authoritative tone." },
  { id: "casual",        label: "Casual",         instruction: "Use a casual, conversational tone — like talking to a friend." },
  { id: "inspirational", label: "Inspirational",  instruction: "Use an inspirational, motivating tone that sparks action." },
  { id: "bold",          label: "Bold",           instruction: "Use a bold, direct, punchy tone. Make strong statements and short sentences." },
];

function systemWithTone(channel, toneId) {
  const tone = TONES.find((t) => t.id === toneId);
  return SYSTEM_PROMPTS[channel] + (tone ? `\n\nTone: ${tone.instruction}` : "");
}

async function generateWithClaude(prompt, channel, tone) {
  const response = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CONFIG.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CONFIG.CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemWithTone(channel, tone),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Claude generation failed");
  }
  const data = await response.json();
  return data.content[0].text;
}

async function generateWithOpenAI(prompt, channel, tone) {
  const response = await fetch("/api/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CONFIG.OPENAI_MODEL,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemWithTone(channel, tone) },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "OpenAI generation failed");
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

function stripCodeFences(text) {
  return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
}

async function generateWithAI(prompt, channel, provider = "claude", tone = "professional") {
  const raw = provider === "openai"
    ? await generateWithOpenAI(prompt, channel, tone)
    : await generateWithClaude(prompt, channel, tone);
  return stripCodeFences(raw);
}

// ─── Copy to clipboard (manual publish) ──────────────────────
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// ─── Firestore helpers ────────────────────────────────────────
async function saveToDB(post) {
  if (!db) return { id: `local-${Date.now()}` };
  const docRef = await addDoc(collection(db, "posts"), {
    ...post,
    createdAt: serverTimestamp(),
  });
  return docRef;
}

async function loadFromDB() {
  if (!db) return [];
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function updateInDB(id, data) {
  if (!db || id.startsWith("local-")) return;
  await updateDoc(doc(db, "posts", id), data);
}

async function deleteFromDB(id) {
  if (!db || id.startsWith("local-")) return;
  await deleteDoc(doc(db, "posts", id));
}

// ─── Status badge ─────────────────────────────────────────────
const STATUS_STYLES = {
  draft:     "bg-gray-100 text-gray-600",
  pending:   "bg-yellow-100 text-yellow-700",
  approved:  "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
};

const CHANNEL_STYLES = {
  linkedin:  "bg-blue-600 text-white",
  wordpress: "bg-indigo-600 text-white",
};

const CHANNEL_ICONS = {
  linkedin:  "in",
  wordpress: "WP",
};

function Badge({ label, style }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style}`}>
      {label}
    </span>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState("dashboard"); // dashboard | create | detail
  const [selectedPost, setSelectedPost] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Load posts ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await loadFromDB();
        setPosts(data);
      } catch (e) {
        showToast("Could not load from Firebase — using local state", "warn");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Create post ──
  async function handleCreatePost(postData) {
    setLoading(true);
    try {
      const newPost = {
        ...postData,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const ref = await saveToDB(newPost);
      newPost.id = ref.id;
      setPosts((prev) => [newPost, ...prev]);
      showToast("Post created — awaiting your approval");
      setView("dashboard");
    } catch (e) {
      showToast("Error saving post: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Approve post ──
  async function handleApprove(post) {
    setLoading(true);
    try {
      await updateInDB(post.id, { status: "approved" });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: "approved" } : p))
      );
      setSelectedPost((p) => p && { ...p, status: "approved" });
      showToast("Post approved!");
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Reject post ──
  async function handleReject(post) {
    setLoading(true);
    try {
      await updateInDB(post.id, { status: "rejected" });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: "rejected" } : p))
      );
      setSelectedPost((p) => p && { ...p, status: "rejected" });
      showToast("Post rejected", "warn");
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Copy post content to clipboard ──
  async function handlePublish(post) {
    if (post.status !== "approved") {
      showToast("Approve the post before copying", "warn");
      return;
    }
    setLoading(true);
    try {
      await copyToClipboard(post.content);
      await updateInDB(post.id, { status: "published" });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: "published" } : p))
      );
      setSelectedPost((p) => p && { ...p, status: "published" });
      showToast(`Copied! Paste it into ${post.channel === "linkedin" ? "LinkedIn" : "WordPress"}.`);
    } catch (e) {
      showToast("Copy failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Delete post ──
  async function handleDelete(postId) {
    if (!confirm("Delete this post?")) return;
    await deleteFromDB(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (selectedPost?.id === postId) {
      setView("dashboard");
      setSelectedPost(null);
    }
    showToast("Post deleted");
  }

  // ── Update content ──
  async function handleUpdateContent(postId, newContent, newTitle) {
    await updateInDB(postId, { content: newContent, title: newTitle, status: "pending" });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, content: newContent, title: newTitle, status: "pending" } : p
      )
    );
    setSelectedPost((p) =>
      p ? { ...p, content: newContent, title: newTitle, status: "pending" } : p
    );
    showToast("Post updated — re-approval required");
  }

  // ── Filtered posts ──
  const filtered = posts.filter((p) => {
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchChannel = filterChannel === "all" || p.channel === filterChannel;
    return matchStatus && matchChannel;
  });

  const counts = {
    all: posts.length,
    pending: posts.filter((p) => p.status === "pending").length,
    approved: posts.filter((p) => p.status === "approved").length,
    published: posts.filter((p) => p.status === "published").length,
    rejected: posts.filter((p) => p.status === "rejected").length,
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── Topbar ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="PostFlow" className="w-8 h-8 rounded-lg object-cover" />
          <h1 className="text-lg font-bold text-gray-900">PostFlow</h1>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Marketing Manager</span>
        </div>
        <div className="flex items-center gap-3">
          {view !== "dashboard" && (
            <button
              onClick={() => { setView("dashboard"); setSelectedPost(null); }}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              ← Dashboard
            </button>
          )}
          <button
            onClick={() => { setView("create"); setSelectedPost(null); }}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + New Post
          </button>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : toast.type === "warn"
              ? "bg-yellow-500 text-white"
              : "bg-green-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="fixed inset-0 bg-white bg-opacity-60 z-40 flex items-center justify-center">
          <div className="flex items-center gap-2 text-blue-600 font-medium">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Processing…
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Dashboard ── */}
        {view === "dashboard" && (
          <Dashboard
            posts={filtered}
            counts={counts}
            filterStatus={filterStatus}
            filterChannel={filterChannel}
            onFilterStatus={setFilterStatus}
            onFilterChannel={setFilterChannel}
            onSelect={(p) => { setSelectedPost(p); setView("detail"); }}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onReject={handleReject}
            onPublish={handlePublish}
          />
        )}

        {/* ── Create ── */}
        {view === "create" && (
          <CreatePost onCreate={handleCreatePost} onCancel={() => setView("dashboard")} />
        )}

        {/* ── Detail / Edit ── */}
        {view === "detail" && selectedPost && (
          <PostDetail
            post={selectedPost}
            onApprove={handleApprove}
            onReject={handleReject}
            onPublish={handlePublish}
            onUpdate={handleUpdateContent}
            onDelete={handleDelete}
            onBack={() => { setView("dashboard"); setSelectedPost(null); }}
          />
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
function Dashboard({
  posts, counts, filterStatus, filterChannel,
  onFilterStatus, onFilterChannel, onSelect, onDelete, onApprove, onReject, onPublish,
}) {
  const statuses = ["all", "pending", "approved", "published", "rejected"];

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onFilterStatus(s)}
            className={`rounded-xl p-4 text-left transition border ${
              filterStatus === s
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{counts[s] ?? 0}</div>
            <div className="text-xs text-gray-500 capitalize mt-0.5">{s === "all" ? "Total Posts" : s}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-sm text-gray-500">Channel:</span>
        {["all", "linkedin", "wordpress"].map((c) => (
          <button
            key={c}
            onClick={() => onFilterChannel(c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
              filterChannel === c
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
            }`}
          >
            {c === "all" ? "All Channels" : c === "linkedin" ? "LinkedIn" : "WordPress"}
          </button>
        ))}
      </div>

      {/* Post list */}
      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-lg font-medium text-gray-500">No posts yet</p>
          <p className="text-sm mt-1">Create your first post using the "New Post" button</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onSelect={onSelect}
              onDelete={onDelete}
              onApprove={onApprove}
              onReject={onReject}
              onPublish={onPublish}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────
function PostCard({ post, onSelect, onDelete, onApprove, onReject, onPublish }) {
  const preview = post.content?.replace(/<[^>]+>/g, "").slice(0, 160) + "…";
  const date = post.createdAt
    ? new Date(typeof post.createdAt === "string" ? post.createdAt : post.createdAt.toDate?.() ?? post.createdAt).toLocaleDateString()
    : "";

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition cursor-pointer group"
      onClick={() => onSelect(post)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${CHANNEL_STYLES[post.channel]}`}>
              {CHANNEL_ICONS[post.channel]} {post.channel === "linkedin" ? "LinkedIn" : "WordPress"}
            </span>
            <Badge label={post.status} style={STATUS_STYLES[post.status]} />
            <span className="text-xs text-gray-400">{date}</span>
          </div>
          {post.title && (
            <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{post.title}</h3>
          )}
          <p className="text-sm text-gray-500 line-clamp-2">{preview}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          {post.status === "pending" && (
            <>
              <button
                onClick={() => onApprove(post)}
                className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => onReject(post)}
                className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium"
              >
                ✗ Reject
              </button>
            </>
          )}
          {post.status === "approved" && (
            <button
              onClick={() => onPublish(post)}
              className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 font-medium"
            >
              📋 Copy
            </button>
          )}
          <button
            onClick={() => onDelete(post.id)}
            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded-lg"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Post ──────────────────────────────────────────────
const AI_PROVIDERS = [
  { id: "claude", label: "Claude", sub: "Anthropic" },
  { id: "openai", label: "GPT-4o", sub: "OpenAI" },
];

function CreatePost({ onCreate, onCancel }) {
  const [channel, setChannel] = useState("linkedin");
  const [provider, setProvider] = useState("claude");
  const [tone, setTone] = useState("professional");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [variations, setVariations] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) { setError("Please enter a prompt"); return; }
    setGenerating(true);
    setError("");
    setVariations([]);
    try {
      const result = await generateWithAI(prompt, channel, provider, tone);
      setContent(result);
      setGeneratedContent(result);
    } catch (e) {
      setError("Generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateVariations() {
    if (!prompt.trim()) { setError("Please enter a prompt"); return; }
    setGenerating(true);
    setError("");
    setVariations([]);
    try {
      const results = await Promise.all([
        generateWithAI(prompt, channel, provider, tone),
        generateWithAI(prompt, channel, provider, tone),
        generateWithAI(prompt, channel, provider, tone),
      ]);
      setVariations(results);
    } catch (e) {
      setError("Generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  function pickVariation(v) {
    setContent(v);
    setGeneratedContent(v);
    setVariations([]);
  }

  function handleSubmit() {
    if (!content.trim()) { setError("Generate or write content first"); return; }
    if (channel === "wordpress" && !title.trim()) { setError("WordPress posts need a title"); return; }
    onCreate({ channel, title, content, prompt, generatedContent });
  }

  const charCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charWarning = channel === "linkedin" && charCount > 2700;
  const charOver    = channel === "linkedin" && charCount > 3000;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Post</h2>

      {/* Channel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Channel</label>
        <div className="flex gap-3">
          {[
            { id: "linkedin", label: "LinkedIn", icon: "in", desc: "Professional post" },
            { id: "wordpress", label: "WordPress Blog", icon: "WP", desc: "Full blog article" },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              className={`flex-1 border-2 rounded-xl p-4 text-left transition ${
                channel === ch.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs font-bold mb-2 ${CHANNEL_STYLES[ch.id]}`}>
                {ch.icon}
              </div>
              <div className="font-semibold text-gray-900 text-sm">{ch.label}</div>
              <div className="text-xs text-gray-500">{ch.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Model + Tone */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">AI Model</label>
          <div className="flex gap-2">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`border-2 rounded-lg px-4 py-2 text-sm transition ${
                  provider === p.id ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {p.label} <span className="text-xs opacity-60">{p.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tone</label>
          <div className="flex gap-2 flex-wrap">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`border-2 rounded-lg px-3 py-1.5 text-sm transition ${
                  tone === t.id ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Title (WordPress only) */}
      {channel === "wordpress" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Post Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 10 Tips for Better Marketing in 2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}

      {/* Prompt + Generate buttons */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          What should this post be about?
        </label>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            channel === "linkedin"
              ? "e.g. Share insights on AI transforming marketing teams in 2026, include a personal story angle"
              : "e.g. Write a blog post about 5 ways to use AI for content marketing, SEO-focused, targeting marketing managers"
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm px-5 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60 transition font-medium flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating…
              </>
            ) : content ? "↻ Regenerate" : "✨ Generate with AI"}
          </button>
          <button
            onClick={handleGenerateVariations}
            disabled={generating}
            className="border border-indigo-300 text-indigo-600 text-sm px-4 py-2.5 rounded-lg hover:bg-indigo-50 disabled:opacity-60 transition font-medium"
          >
            Generate 3 Variations
          </button>
        </div>
      </div>

      {/* Variations picker */}
      {variations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Pick a variation</p>
          <div className="space-y-3">
            {variations.map((v, i) => (
              <button
                key={i}
                onClick={() => pickVariation(v)}
                className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition"
              >
                <span className="text-xs font-bold text-indigo-600 mb-1 block">Variation {i + 1}</span>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {v.replace(/<[^>]+>/g, "").slice(0, 220)}{v.length > 220 ? "…" : ""}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content editor */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">
            {channel === "wordpress" ? "Article HTML" : "Post Content"}
          </label>
          <div className="flex items-center gap-3">
            {content && generatedContent && content !== generatedContent && (
              <button
                onClick={() => setContent(generatedContent)}
                className="text-xs text-gray-400 hover:text-indigo-600"
              >
                ↺ Revert to generated
              </button>
            )}
            {content && (
              <span className={`text-xs font-medium ${
                charOver ? "text-red-500" : charWarning ? "text-yellow-500" : "text-gray-400"
              }`}>
                {channel === "linkedin" ? `${charCount} / 3000` : `${wordCount} words`}
              </span>
            )}
          </div>
        </div>
        <textarea
          rows={channel === "wordpress" ? 14 : 10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            channel === "linkedin"
              ? "AI-generated content will appear here. You can also write or edit directly…"
              : "AI-generated HTML will appear here. You can also write or edit directly…"
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        {channel === "wordpress" && content && (
          <details className="mt-3">
            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">Preview rendered HTML</summary>
            <div
              className="mt-2 prose prose-sm max-w-none border rounded-lg p-4 bg-gray-50 text-sm"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </details>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Save for Approval →
        </button>
        <button
          onClick={onCancel}
          className="text-gray-600 text-sm px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Image editing helpers ────────────────────────────────────
function buildImgTag(src, alt, size, align) {
  let style = `max-width:${size};`;
  if (align === "center") style += " display:block; margin-left:auto; margin-right:auto;";
  else if (align === "left")  style += " float:left; margin:0 16px 8px 0;";
  else if (align === "right") style += " float:right; margin:0 0 8px 16px;";
  else style += " display:block;";
  return `<img src="${src}" alt="${alt}" style="${style}" />`;
}

function parseImagesFromHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return Array.from(div.querySelectorAll("img")).map((img) => {
    const style = img.getAttribute("style") || "";
    const sizeMatch = style.match(/max-width:\s*([^;]+)/);
    const size = sizeMatch ? sizeMatch[1].trim() : "100%";
    let align = "none";
    if (style.includes("margin-left:auto") || style.includes("margin:0 auto")) align = "center";
    else if (style.includes("float:left"))  align = "left";
    else if (style.includes("float:right")) align = "right";
    return { src: img.getAttribute("src") || "", alt: img.getAttribute("alt") || "", size, align };
  });
}

function applyImgEditsToHtml(html, edits) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const imgs = div.querySelectorAll("img");
  edits.forEach((edit, i) => {
    if (!imgs[i]) return;
    imgs[i].setAttribute("alt", edit.alt);
    let style = `max-width:${edit.size};`;
    if (edit.align === "center") style += " display:block; margin-left:auto; margin-right:auto;";
    else if (edit.align === "left")  style += " float:left; margin:0 16px 8px 0;";
    else if (edit.align === "right") style += " float:right; margin:0 0 8px 16px;";
    else style += " display:block;";
    imgs[i].setAttribute("style", style);
  });
  return div.innerHTML;
}

function removeImgFromHtml(html, index) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const imgs = div.querySelectorAll("img");
  if (imgs[index]) imgs[index].remove();
  return div.innerHTML;
}
// ─────────────────────────────────────────────────────────────

// ─── Post Detail ──────────────────────────────────────────────
function PostDetail({ post, onApprove, onReject, onPublish, onUpdate, onDelete, onBack }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editTitle, setEditTitle] = useState(post.title || "");
  const [imgPicker, setImgPicker] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [imgUploading, setImgUploading] = useState(false);
  const [imgAlt, setImgAlt] = useState("");
  const [imgSize, setImgSize] = useState("100%");
  const [imgAlign, setImgAlign] = useState("center");
  const [imgManager, setImgManager] = useState(false);
  const [imgEdits, setImgEdits] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    setEditContent(post.content);
    setEditTitle(post.title || "");
  }, [post]);

  function saveEdit() {
    onUpdate(post.id, editContent, editTitle);
    setEditing(false);
    setPreviewMode(false);
    setFindOpen(false);
  }

  function handleFindReplace() {
    if (!findText) return;
    setEditContent((c) => c.replaceAll(findText, replaceText));
  }

  function insertAtCursor(text) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = editContent.slice(0, start) + text + editContent.slice(end);
    setEditContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }

  function handleInsertImageUrl() {
    if (!imgUrl.trim()) return;
    const tag = post.channel === "wordpress"
      ? buildImgTag(imgUrl.trim(), imgAlt, imgSize, imgAlign)
      : imgUrl.trim();
    insertAtCursor(tag);
    setImgUrl(""); setImgAlt(""); setImgSize("100%"); setImgAlign("center");
    setImgPicker(false);
  }

  async function handleInsertImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!storage) {
      alert("Firebase Storage is not initialised. Check your .env config.");
      return;
    }
    setImgUploading(true);
    try {
      const path = `post-images/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const tag = post.channel === "wordpress"
        ? buildImgTag(url, imgAlt || file.name, imgSize, imgAlign)
        : url;
      insertAtCursor(tag);
      setImgAlt(""); setImgSize("100%"); setImgAlign("center");
      setImgPicker(false);
    } catch (err) {
      alert("Image upload failed: " + err.message);
    } finally {
      setImgUploading(false);
    }
  }

  function openImgManager() {
    setImgEdits(parseImagesFromHtml(editContent));
    setImgManager(true);
  }

  function applyImgManager() {
    setEditContent(applyImgEditsToHtml(editContent, imgEdits));
    setImgManager(false);
  }

  function removeImgAt(index) {
    setEditContent(removeImgFromHtml(editContent, index));
    setImgEdits((prev) => prev.filter((_, i) => i !== index));
  }

  function updateImgEdit(index, field, value) {
    setImgEdits((prev) => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }

  const date = post.createdAt
    ? new Date(typeof post.createdAt === "string" ? post.createdAt : post.createdAt.toDate?.() ?? post.createdAt).toLocaleString()
    : "";

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${CHANNEL_STYLES[post.channel]}`}>
              {CHANNEL_ICONS[post.channel]} {post.channel === "linkedin" ? "LinkedIn" : "WordPress"}
            </span>
            <Badge label={post.status} style={STATUS_STYLES[post.status]} />
            <span className="text-xs text-gray-400">{date}</span>
          </div>
          {post.title && (
            <h2 className="text-xl font-bold text-gray-900">{post.title}</h2>
          )}
        </div>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800">← Back</button>
      </div>

      {/* Prompt used */}
      {post.prompt && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Prompt used</p>
          <p className="text-sm text-gray-700">{post.prompt}</p>
        </div>
      )}

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Content</p>
          {!editing && post.status !== "published" && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div>
            {post.channel === "wordpress" && (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Post title"
              />
            )}
            {/* Edit toolbar */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button
                onClick={() => { setImgPicker((v) => !v); setImgManager(false); }}
                className={`text-xs border px-3 py-1.5 rounded-lg transition ${imgPicker ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-300 hover:bg-gray-50 text-gray-600"}`}
              >
                🖼 Insert Image
              </button>
              {post.channel === "wordpress" && (
                <button
                  onClick={() => { setImgManager((v) => !v); if (!imgManager) openImgManager(); setImgPicker(false); }}
                  className={`text-xs border px-3 py-1.5 rounded-lg transition ${imgManager ? "border-purple-400 bg-purple-50 text-purple-700" : "border-gray-300 hover:bg-gray-50 text-gray-600"}`}
                >
                  🗂 Manage Images
                </button>
              )}
              {post.channel === "wordpress" && (
                <button
                  onClick={() => setPreviewMode((v) => !v)}
                  className={`text-xs border px-3 py-1.5 rounded-lg transition ${
                    previewMode
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-300 hover:bg-gray-50 text-gray-600"
                  }`}
                >
                  {previewMode ? "✎ Code" : "👁 Preview"}
                </button>
              )}
              <button
                onClick={() => setFindOpen((v) => !v)}
                className={`text-xs border px-3 py-1.5 rounded-lg transition ${
                  findOpen
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-300 hover:bg-gray-50 text-gray-600"
                }`}
              >
                🔍 Find & Replace
              </button>
              {editContent !== post.content && (
                <button
                  onClick={() => { setEditContent(post.content); setEditTitle(post.title || ""); }}
                  className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500"
                >
                  ↺ Revert
                </button>
              )}
            </div>

            {/* Find & Replace panel */}
            {findOpen && (
              <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 mb-3 flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-32">
                  <p className="text-xs text-gray-500 mb-1">Find</p>
                  <input
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="text to find"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div className="flex-1 min-w-32">
                  <p className="text-xs text-gray-500 mb-1">Replace with</p>
                  <input
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="replacement"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <button
                  onClick={handleFindReplace}
                  className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-orange-600"
                >
                  Replace All
                </button>
              </div>
            )}

            {imgPicker && (
              <div className="border border-blue-200 rounded-xl p-4 mb-3 bg-blue-50 space-y-3">

                {/* Source: upload */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Upload from device</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file" accept="image/*" disabled={imgUploading}
                      onChange={handleInsertImageFile}
                      className="text-xs text-gray-600 file:mr-2 file:text-xs file:border file:border-gray-300 file:rounded file:px-2 file:py-1 file:bg-white hover:file:bg-gray-50 disabled:opacity-50"
                    />
                    {imgUploading && <span className="text-xs text-gray-500">Uploading…</span>}
                  </div>
                </div>

                {/* Source: URL */}
                <div className="border-t border-blue-200 pt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Or paste image URL</p>
                  <div className="flex gap-2">
                    <input
                      type="text" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInsertImageUrl()}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Options (WordPress only) */}
                {post.channel === "wordpress" && (
                  <div className="border-t border-blue-200 pt-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Alt text</p>
                      <input
                        type="text" value={imgAlt} onChange={(e) => setImgAlt(e.target.value)}
                        placeholder="Describe the image…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Size</p>
                        <div className="flex gap-1">
                          {["25%","50%","75%","100%"].map((s) => (
                            <button key={s} onClick={() => setImgSize(s)}
                              className={`text-xs px-2 py-1 rounded border transition ${imgSize === s ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Alignment</p>
                        <div className="flex gap-1">
                          {[["left","◀ Left"],["center","■ Center"],["right","▶ Right"],["none","— None"]].map(([val,label]) => (
                            <button key={val} onClick={() => setImgAlign(val)}
                              className={`text-xs px-2 py-1 rounded border transition ${imgAlign === val ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-blue-200 pt-3">
                  <button onClick={handleInsertImageUrl} disabled={!imgUrl.trim()}
                    className="bg-blue-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40">
                    Insert from URL
                  </button>
                  <button onClick={() => { setImgPicker(false); setImgUrl(""); setImgAlt(""); setImgSize("100%"); setImgAlign("center"); }}
                    className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Image Manager */}
            {imgManager && post.channel === "wordpress" && (
              <div className="border border-purple-200 rounded-xl p-4 mb-3 bg-purple-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-purple-800">Images in this post</p>
                  <div className="flex gap-2">
                    <button onClick={applyImgManager}
                      className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-purple-700">
                      Apply Changes
                    </button>
                    <button onClick={() => setImgManager(false)}
                      className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100">
                      Cancel
                    </button>
                  </div>
                </div>

                {imgEdits.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No images found in this post.</p>
                ) : (
                  <div className="space-y-3">
                    {imgEdits.map((img, i) => (
                      <div key={i} className="bg-white border border-purple-100 rounded-xl p-3 flex gap-3">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                          <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                        </div>

                        {/* Controls */}
                        <div className="flex-1 space-y-2 min-w-0">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Alt text</p>
                            <input
                              type="text" value={img.alt}
                              onChange={(e) => updateImgEdit(i, "alt", e.target.value)}
                              placeholder="Describe the image…"
                              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                            />
                          </div>
                          <div className="flex gap-3 flex-wrap">
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Size</p>
                              <div className="flex gap-1">
                                {["25%","50%","75%","100%"].map((s) => (
                                  <button key={s} onClick={() => updateImgEdit(i, "size", s)}
                                    className={`text-xs px-2 py-0.5 rounded border transition ${img.size === s ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Alignment</p>
                              <div className="flex gap-1">
                                {[["left","◀"],["center","■"],["right","▶"],["none","—"]].map(([val,label]) => (
                                  <button key={val} onClick={() => updateImgEdit(i, "align", val)}
                                    className={`text-xs px-2 py-0.5 rounded border transition ${img.align === val ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Remove */}
                        <button onClick={() => removeImgAt(i)}
                          className="flex-shrink-0 text-gray-300 hover:text-red-500 text-lg leading-none self-start">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {previewMode && post.channel === "wordpress" ? (
              <div
                className="w-full border border-gray-300 rounded-lg px-3 py-3 prose prose-sm max-w-none bg-gray-50 min-h-48 text-sm"
                dangerouslySetInnerHTML={{ __html: editContent }}
              />
            ) : (
              <textarea
                ref={textareaRef}
                rows={14}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={saveEdit}
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => { setEditing(false); setEditContent(post.content); setEditTitle(post.title || ""); }}
                className="text-gray-600 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : post.channel === "wordpress" ? (
          <div
            className="prose prose-sm max-w-none text-sm text-gray-800"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
            {post.content}
          </pre>
        )}
      </div>

      {/* Actions */}
      {post.status !== "published" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Actions</p>
          <div className="flex flex-wrap gap-3">
            {post.status === "pending" && (
              <>
                <button
                  onClick={() => onApprove(post)}
                  className="bg-blue-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
                >
                  ✓ Approve Post
                </button>
                <button
                  onClick={() => onReject(post)}
                  className="bg-red-50 text-red-600 border border-red-200 text-sm px-5 py-2.5 rounded-lg hover:bg-red-100 font-medium"
                >
                  ✗ Reject Post
                </button>
              </>
            )}
            {post.status === "approved" && (
              <button
                onClick={() => onPublish(post)}
                className="bg-green-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-green-700 font-medium"
              >
                📋 Copy for {post.channel === "linkedin" ? "LinkedIn" : "WordPress"}
              </button>
            )}
            {post.status === "rejected" && (
              <button
                onClick={() => onApprove(post)}
                className="bg-blue-50 text-blue-600 border border-blue-200 text-sm px-5 py-2.5 rounded-lg hover:bg-blue-100 font-medium"
              >
                ↺ Re-approve
              </button>
            )}
            <button
              onClick={() => onDelete(post.id)}
              className="text-gray-400 text-sm px-4 py-2.5 rounded-lg border border-gray-200 hover:text-red-500 hover:border-red-200"
            >
              Delete Post
            </button>
          </div>
        </div>
      )}

      {post.status === "published" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <p className="font-semibold text-green-800">
            Copied for {post.channel === "linkedin" ? "LinkedIn" : "WordPress"}!
          </p>
          <p className="text-sm text-green-600 mt-1">Content was copied — paste it manually into the platform.</p>
          <button
            onClick={() => onPublish(post)}
            className="mt-4 bg-green-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-green-700 font-medium"
          >
            📋 Copy Again
          </button>
        </div>
      )}
    </div>
  );
}
