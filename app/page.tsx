"use client";

import { useState, useEffect, useRef, useMemo, type ReactElement } from "react";
import Image from "next/image";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { markedHighlight } from "marked-highlight";
import { BirdPredictionResponse } from "@/types/bird-prediction-response";
import { SpeciesResponse } from "@/types/species-response";

// Configure marked with GFM and syntax highlighting once at module scope.
// Re-configuring on each render can leak handlers and balloon CPU/memory, especially during SSE.
(() => {
  type G = { __MARKED_CONFIGURED__?: boolean };
  const g = globalThis as unknown as G;
  if (!g.__MARKED_CONFIGURED__) {
    marked.use({ gfm: true, breaks: true });
    marked.use(
      markedHighlight({
        langPrefix: "hljs language-",
        highlight(code: string, lang: string) {
          try {
            // Only highlight when the language is explicitly known; skip expensive auto-detect.
            if (lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang }).value;
            }
            return code;
          } catch {
            return code;
          }
        },
      })
    );
    g.__MARKED_CONFIGURED__ = true;
  }
})();

// Markdown -> sanitized HTML renderer using marked + DOMPurify
const DOMPURIFY_ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
  "span",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "input",
];
const DOMPURIFY_ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "class",
  "type",
  "checked",
  "disabled",
];

export default function Home() {
  // Shared prompt history across chats
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [chatHistIdx, setChatHistIdx] = useState<number>(-1);
  const [sseHistIdx, setSseHistIdx] = useState<number>(-1);
  const [chatDraft, setChatDraft] = useState<string>("");
  const [sseDraft, setSseDraft] = useState<string>("");

  // Load/save history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("promptHistory");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr))
          setPromptHistory(arr.filter((v) => typeof v === "string"));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("promptHistory", JSON.stringify(promptHistory));
    } catch {}
  }, [promptHistory]);

  const addToHistory = (p: string) => {
    const prompt = p.trim();
    if (!prompt) return;
    setPromptHistory((prev) => {
      if (prev.length && prev[prev.length - 1] === prompt) return prev; // avoid consecutive dupes
      return [...prev, prompt];
    });
  };

  const MarkdownView = ({
    content,
    normalize = false,
  }: {
    content: string;
    normalize?: boolean;
  }) => {
    const html = useMemo(() => {
      // Minimal normalization: decode escaped \n/\t and repair split backticks only.
      const normalizeMarkdown = (txt: string) => {
        const needsDecode = /\\[nrt]/.test(txt) || /``\s*`|`\s*``/.test(txt);
        if (!needsDecode) return txt;
        const segments: { type: "code" | "text"; value: string }[] = [];
        const fenceRe = /```[^\n]*\n[\s\S]*?```/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = fenceRe.exec(txt)) !== null) {
          if (m.index > last)
            segments.push({ type: "text", value: txt.slice(last, m.index) });
          segments.push({ type: "code", value: m[0] });
          last = fenceRe.lastIndex;
        }
        if (last < txt.length)
          segments.push({ type: "text", value: txt.slice(last) });

        const rebuilt = segments
          .map((seg) => {
            if (seg.type === "code") {
              // Only repair split backticks inside code fences.
              return seg.value
                .replace(/``\s*`/g, "```")
                .replace(/`\s*``/g, "```");
            }
            // Decode escaped newlines/tabs and repair split backticks in prose segments only.
            return seg.value
              .replace(/\\r\\n|\\n\\r/g, "\n")
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t")
              .replace(/``\s*`/g, "```")
              .replace(/`\s*``/g, "```");
          })
          .join("");
        return rebuilt;
      };
      const prepared = normalize ? normalizeMarkdown(content) : content;
      const raw = marked.parse(prepared) as string;
      console.log('raw', raw);
      return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: DOMPURIFY_ALLOWED_TAGS,
        ALLOWED_ATTR: DOMPURIFY_ALLOWED_ATTR,
      });
    }, [content, normalize]);
    console.log('html', html);
    return (
      <div
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };
  // Chat modal state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<
    { role: string; content: string }[]
  >([]);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Streaming chat modal state (SSE)
  const [sseChatOpen, setSseChatOpen] = useState(false);
  const [sseInput, setSseInput] = useState("");
  const [sseHistory, setSseHistory] = useState<
    { role: string; content: string }[]
  >([]);
  const sseInputRef = useRef<HTMLInputElement>(null);
  const [sseBusy, setSseBusy] = useState(false);
  const sseEventSourceRef = useRef<EventSource | null>(null);
  const sseBotIndexRef = useRef<number | null>(null);
  const sseEndRef = useRef<HTMLDivElement>(null);
  const sseBufferRef = useRef<string>("");
  // Batch SSE UI updates to reduce layout thrash during fast streams
  const sseFlushTimerRef = useRef<number | null>(null);

  const scrollToBottom = (which: "chat" | "sse", smooth = true) => {
    const el = which === "chat" ? chatEndRef.current : sseEndRef.current;
    if (el) {
      el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    }
  };

  const handleSseSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!sseInput.trim() || sseBusy) return;
    // Close any existing stream before starting a new one
    try {
      sseEventSourceRef.current?.close();
    } catch {}
    const prompt = sseInput.trim();
    addToHistory(prompt);
    setSseHistIdx(-1);
    setSseDraft("");
    sseBufferRef.current = "";
    // push user + placeholder bot in a single state update and store bot index
    setSseHistory((prev) => {
      const next = [
        ...prev,
        { role: "user", content: prompt },
        { role: "bot", content: "" },
      ];
      sseBotIndexRef.current = next.length - 1;
      return next;
    });
    setSseInput("");
    setSseBusy(true);
    try {
      const es = new EventSource(
        `/api/chatbotsse?prompt=${encodeURIComponent(prompt)}`
      );
      sseEventSourceRef.current = es;
      // Server now emits custom 'update' events with JSON { content: string }
      es.addEventListener("update", (ev: MessageEvent) => {
        try {
          const data = ev.data;
          let chunk = "";
          try {
            const j = JSON.parse(data);
            if (typeof j?.content === "string") {
              chunk = j.content;
            }
          } catch {
            // Fallback to raw string if not JSON
            chunk = String(data);
          }
          if (!chunk) return;
          // Append chunk to buffer
          const nextBuffer = sseBufferRef.current + chunk;
          sseBufferRef.current = nextBuffer;
          // Debounce UI flush ~50ms
          if (sseFlushTimerRef.current == null) {
            sseFlushTimerRef.current = window.setTimeout(() => {
              sseFlushTimerRef.current = null;
              const idx = sseBotIndexRef.current;
              if (idx !== null) {
                const content = sseBufferRef.current;
                setSseHistory((prev) => {
                  const next = [...prev];
                  if (next[idx]) {
                    next[idx] = { ...next[idx], content };
                  }
                  return next;
                });
              }
            }, 50);
          }
        } catch {
          // ignore parse errors per chunk
        }
      });
      es.onerror = () => {
        // EventSource fires 'error' when the stream ends or errors; mark idle and close.
        try {
          es.close();
        } finally {
          setSseBusy(false);
          sseEventSourceRef.current = null;
        }
      };
    } catch {
      setSseHistory((prev) => [
        ...prev,
        { role: "bot", content: "Error: Unable to open stream." },
      ]);
      setSseBusy(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const prompt = chatInput.trim();
    addToHistory(prompt);
    setChatHistIdx(-1);
    setChatDraft("");
    setChatHistory((prev) => [...prev, { role: "user", content: prompt }]);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await fetch(
        `/api/chatbot?prompt=${encodeURIComponent(prompt)}`
      );
      if (res.ok) {
        const data = await res.json();
        setChatHistory((prev) => [
          ...prev,
          { role: "bot", content: data.response || "(No response)" },
        ]);
        setChatBusy(false);
      } else {
        setChatHistory((prev) => [
          ...prev,
          { role: "bot", content: "Error: Unable to get response." },
        ]);
        setChatBusy(false);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "bot", content: "Error: Unable to get response." },
      ]);
      setChatBusy(false);
    }
  };
  const [result, setResult] = useState<BirdPredictionResponse | string | null>(
    null
  );
  const [species, setSpecies] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showSpecies, setShowSpecies] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [modelType, setModelType] = useState<"self" | "hf">("self");
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("image", file);
    try {
      const endpoint = `/api/birdsubmit?model=${modelType}`;
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        const data = (await response.json()) as BirdPredictionResponse;
        setResult(data);
      } else {
        // Try to get error details from response
        let errorText = "Failed to submit image.";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorText =
              errorData.error +
              (errorData.details ? `\n${errorData.details}` : "");
          }
        } catch {}
        setResult(errorText);
      }
    } catch (err) {
      setResult("Error submitting image: " + String(err));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleImageFile(file);
  };

  useEffect(() => {
    const fetchSpecies = async () => {
      try {
        const response = await fetch("/api/species");
        if (response.ok) {
          const data: SpeciesResponse = await response.json();
          setSpecies(data.species.sort());
        }
      } catch {
        setSpecies([]);
      }
    };
    fetchSpecies();
  }, []);
  // Auto-scroll when content changes
  useEffect(() => {
    if (chatOpen) scrollToBottom("chat", true);
  }, [chatHistory, chatBusy, chatOpen]);
  useEffect(() => {
    if (sseChatOpen) scrollToBottom("sse", false); // avoid smooth to reduce jitter during streaming
  }, [sseHistory, sseBusy, sseChatOpen]);

  // Reset per-modal history index when opening
  useEffect(() => {
    if (chatOpen) {
      setChatHistIdx(-1);
      setChatDraft("");
    }
  }, [chatOpen]);
  useEffect(() => {
    if (sseChatOpen) {
      setSseHistIdx(-1);
      setSseDraft("");
    }
  }, [sseChatOpen]);

  // Handlers to navigate history for inputs
  const handleHistoryNav = (
    e: React.KeyboardEvent<HTMLInputElement>,
    which: "chat" | "sse"
  ) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (promptHistory.length === 0) return;
    e.preventDefault();
    if (which === "chat") {
      const len = promptHistory.length;
      if (e.key === "ArrowUp") {
        if (chatHistIdx === -1) {
          setChatDraft(chatInput);
          const idx = len - 1;
          setChatHistIdx(idx);
          setChatInput(promptHistory[idx] ?? chatInput);
        } else if (chatHistIdx > 0) {
          const idx = chatHistIdx - 1;
          setChatHistIdx(idx);
          setChatInput(promptHistory[idx] ?? chatInput);
        }
      } else if (e.key === "ArrowDown") {
        if (chatHistIdx === -1) return;
        if (chatHistIdx < len - 1) {
          const idx = chatHistIdx + 1;
          setChatHistIdx(idx);
          setChatInput(promptHistory[idx] ?? chatInput);
        } else {
          setChatHistIdx(-1);
          setChatInput(chatDraft);
        }
      }
    } else {
      const len = promptHistory.length;
      if (e.key === "ArrowUp") {
        if (sseHistIdx === -1) {
          setSseDraft(sseInput);
          const idx = len - 1;
          setSseHistIdx(idx);
          setSseInput(promptHistory[idx] ?? sseInput);
        } else if (sseHistIdx > 0) {
          const idx = sseHistIdx - 1;
          setSseHistIdx(idx);
          setSseInput(promptHistory[idx] ?? sseInput);
        }
      } else if (e.key === "ArrowDown") {
        if (sseHistIdx === -1) return;
        if (sseHistIdx < len - 1) {
          const idx = sseHistIdx + 1;
          setSseHistIdx(idx);
          setSseInput(promptHistory[idx] ?? sseInput);
        } else {
          setSseHistIdx(-1);
          setSseInput(sseDraft);
        }
      }
    }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-8 relative">
      {/* Typing dots component */}
      {/* Renders three bouncing dots to indicate the bot is responding */}
      {(() => {
        const TypingDots = ({
          colorClass = "text-gray-700 dark:text-gray-200",
        }: {
          colorClass?: string;
        }) => (
          <div
            className={`inline-flex items-center gap-1 ${colorClass}`}
            aria-label="Bot is typing"
          >
            <span className="animate-bounce text-xl leading-none">.</span>
            <span
              className="animate-bounce text-xl leading-none"
              style={{ animationDelay: "0.15s" }}
            >
              .
            </span>
            <span
              className="animate-bounce text-xl leading-none"
              style={{ animationDelay: "0.3s" }}
            >
              .
            </span>
          </div>
        );
        // expose to JSX below via a typed attachment to globalThis to avoid re-creating component
        type G = {
          __TypingDots?: (props: { colorClass?: string }) => ReactElement;
        };
        (globalThis as unknown as G).__TypingDots =
          TypingDots as unknown as G["__TypingDots"];
        return null;
      })()}
      {/* Invisible chat button bottom right */}
      <button
        type="button"
        aria-label="Open chat"
        className="fixed bottom-6 right-6 w-[50px] h-[50px] bg-transparent opacity-0 z-50 cursor-pointer"
        style={{ border: "none" }}
        onClick={() => setChatOpen(true)}
      />

      {/* Invisible streaming chat button bottom left */}
      <button
        type="button"
        aria-label="Open streaming chat"
        className="fixed bottom-6 left-6 w-[50px] h-[50px] bg-transparent opacity-0 z-50 cursor-pointer"
        style={{ border: "none" }}
        onClick={() => setSseChatOpen(true)}
      />

      {/* Chat modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full h-full">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full h-full flex flex-col">
              {/* Modal close button */}
              <button
                type="button"
                className="absolute top-2 right-4 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-xl font-bold"
                aria-label="Close chat"
                onClick={() => setChatOpen(false)}
              >
                ×
              </button>
              {/* Chat history */}
              <div
                className="flex-1 overflow-y-auto p-4 pb-2"
                style={{ marginTop: "2rem" }}
              >
                {chatHistory.length === 0 ? (
                  <div className="text-gray-400 text-center">
                    Start a conversation!
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-2 flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${
                          msg.role === "user"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        <MarkdownView content={msg.content} />
                      </div>
                    </div>
                  ))
                )}
                {chatBusy && (
                  <div className="mb-2 flex justify-start">
                    <div className="px-3 py-2 rounded-lg max-w-[80%] text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      {(() => {
                        type G = {
                          __TypingDots?: (props: {
                            colorClass?: string;
                          }) => ReactElement;
                        };
                        const TD = (globalThis as unknown as G).__TypingDots;
                        return TD ? TD({}) : null;
                      })()}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {/* Chat input */}
              <form
                className="flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700"
                onSubmit={handleChatSubmit}
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none"
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) handleChatSubmit(e);
                    else handleHistoryNav(e, "chat");
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold shadow"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Streaming Chat modal (SSE) */}
      {sseChatOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full h-full">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full h-full flex flex-col">
              {/* Modal close button */}
              <button
                type="button"
                className="absolute top-2 right-4 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-xl font-bold"
                aria-label="Close streaming chat"
                onClick={() => {
                  setSseChatOpen(false);
                  sseEventSourceRef.current?.close();
                  sseEventSourceRef.current = null;
                  setSseBusy(false);
                }}
              >
                ×
              </button>
              {/* Chat history */}
              <div
                className="flex-1 overflow-y-auto p-4 pb-2"
                style={{ marginTop: "2rem" }}
              >
                {sseHistory.length === 0 ? (
                  <div className="text-gray-400 text-center">
                    Start a streaming conversation!
                  </div>
                ) : (
                  sseHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-2 flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${
                          msg.role === "user"
                            ? "bg-green-100 text-green-900"
                            : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        <MarkdownView content={msg.content} />
                        {idx === sseHistory.length - 1 &&
                          sseBusy &&
                          msg.role === "bot" &&
                          (!msg.content || msg.content.length === 0) && (
                            <span className="ml-2 align-middle">
                              {(() => {
                                type G = {
                                  __TypingDots?: (props: {
                                    colorClass?: string;
                                  }) => ReactElement;
                                };
                                const TD = (globalThis as unknown as G)
                                  .__TypingDots;
                                return TD ? TD({}) : null;
                              })()}
                            </span>
                          )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={sseEndRef} />
              </div>
              {/* Chat input */}
              <form
                className="flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700"
                onSubmit={handleSseSubmit}
              >
                <input
                  ref={sseInputRef}
                  type="text"
                  className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none disabled:opacity-60"
                  placeholder="Type your message to stream..."
                  value={sseInput}
                  onChange={(e) => setSseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) handleSseSubmit(e);
                    else handleHistoryNav(e, "sse");
                  }}
                  disabled={sseBusy}
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold shadow disabled:opacity-60"
                  disabled={sseBusy}
                >
                  {sseBusy ? "Streaming" : "Send"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-[1280px] mx-auto flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-900 dark:text-white">
          Bird Watcher
        </h1>
        <p className="mb-6 text-lg text-gray-700 dark:text-gray-300 text-center max-w-2xl">
          Welcome to Bird Watcher! Upload a photo of a bird, and our AI will try
          to identify its species and tell you how confident it is in the
          prediction. Explore the list of species our model knows, and enjoy
          discovering more about the birds around you.
        </p>

        {/* Model selection pill radio group */}
        <div className="flex gap-4 mb-6">
          <button
            type="button"
            className={`px-4 py-2 rounded-full font-semibold shadow transition-colors duration-200 border border-blue-600 focus:outline-none ${
              modelType === "self"
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600 dark:bg-gray-900 dark:text-blue-300"
            }`}
            onClick={() => setModelType("self")}
            aria-pressed={modelType === "self"}
          >
            Self-trained
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-full font-semibold shadow transition-colors duration-200 border border-blue-600 focus:outline-none ${
              modelType === "hf"
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600 dark:bg-gray-900 dark:text-blue-300"
            }`}
            onClick={() => setModelType("hf")}
            aria-pressed={modelType === "hf"}
          >
            Hugging Face Pretrained Model
          </button>
        </div>

        <form className="flex flex-col items-center gap-4 bg-gray-100 dark:bg-gray-800 p-6 rounded shadow-md max-w-[400px]">
          {/* Camera/Gallery button */}
          <button
            type="button"
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow font-semibold"
            onClick={() => cameraInputRef.current?.click()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7h2l2-3h6l2 3h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2zm9 4a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Camera / Gallery</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            id="image-upload"
            name="image"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageChange}
          />

          {/* Drag and drop area with hover state */}
          <div
            className={`relative w-full max-w-[300px] p-8 h-32 sm:h-40 flex items-center justify-center text-sm text-gray-500 border-2 border-dashed rounded-lg mb-2 transition-colors duration-200 ${
              dropActive
                ? "border-blue-600 bg-blue-50 dark:bg-blue-900"
                : "border-blue-300 bg-white dark:bg-gray-800"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(false);
              const file = e.dataTransfer.files?.[0];
              handleImageFile(file);
            }}
            onClick={() => cameraInputRef.current?.click()}
          >
            <span
              className={`pointer-events-none transition-colors duration-200 text-lg font-semibold text-center w-full ${
                dropActive
                  ? "text-blue-700 dark:text-blue-200"
                  : "text-gray-500 dark:text-gray-300"
              }`}
            >
              {dropActive
                ? "Release to drop your image!"
                : "Drop an image here or click to select"}
            </span>
            {/** Secondary hidden input removed; primary input above is used for both click and camera/gallery */}
          </div>

          {imagePreview && (
            <Image
              src={imagePreview}
              alt="Selected bird preview"
              width={160}
              height={160}
              unoptimized
              className="mt-4 rounded shadow w-40 h-40 object-cover border border-gray-300 dark:border-gray-700"
            />
          )}
        </form>

        {result && typeof result === "string" && (
          <pre className="mt-6 p-4 bg-red-100 dark:bg-red-900 rounded text-sm w-full max-w-xl overflow-auto whitespace-pre-wrap break-words text-red-800 dark:text-red-200 text-center">
            {result}
          </pre>
        )}
        {result && typeof result === "object" && (
          <pre className="mt-6 p-4 bg-gray-200 dark:bg-gray-700 rounded text-sm w-full max-w-xl overflow-auto whitespace-pre-wrap break-words">
            {`There is a ${(result.confidence * 100).toFixed(
              2
            )}% chance that your image was a ${result.predicted_species}.`}
          </pre>
        )}

        {species.length > 0 && (
          <div className="pt-8 w-full flex flex-col items-center">
            <button
              type="button"
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded shadow hover:bg-blue-200 dark:hover:bg-blue-800 font-medium mb-2"
              onClick={() => setShowSpecies((prev) => !prev)}
            >
              {`The self-trained model has learned ${species.length} species`}
              <span className="ml-2">{showSpecies ? "▲" : "▼"}</span>
            </button>
            <div
              className={`transition-all duration-500 ease-in-out overflow-hidden w-full max-w-xl ${
                showSpecies ? "opacity-100" : "opacity-0"
              }`}
              style={{
                marginTop: showSpecies ? "0.5rem" : "0",
                maxHeight: showSpecies ? "none" : "0",
                height: showSpecies ? "auto" : "0",
              }}
            >
              <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded text-sm w-full whitespace-pre-wrap break-words">
                <table className="hidden sm:block w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="pb-2 font-semibold text-gray-700 dark:text-gray-200">
                        Species Name
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(species.length / 5) }).map(
                      (_, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="border-b border-gray-200 dark:border-gray-700"
                        >
                          {Array.from({ length: 5 }).map((_, colIdx) => {
                            const speciesIdx = rowIdx * 5 + colIdx;
                            return (
                              <td className="py-1 px-2" key={colIdx}>
                                {species[speciesIdx] || ""}
                              </td>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
                <div className="flex sm:hidden justify-center w-full">
                  <table className=" w-full max-w-xs text-left text-xs">
                    <thead>
                      <tr>
                        <th className="pb-2 font-semibold text-gray-700 dark:text-gray-200">
                          Species Name
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({
                        length: Math.ceil(species.length / 2),
                      }).map((_, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="border-b border-gray-200 dark:border-gray-700"
                        >
                          {Array.from({ length: 2 }).map((_, colIdx) => {
                            const speciesIdx = rowIdx * 2 + colIdx;
                            return (
                              <td className="py-1 px-2" key={colIdx}>
                                {species[speciesIdx] || ""}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </pre>
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-gray-500 dark:text-gray-400 max-w-[720px]">
          <p>
            <strong>Disclaimer:</strong> This AI-powered bird prediction is just
            for fun and guidance! Results may not be 100% accurate—after all,
            even the smartest birds get confused sometimes. Please use this tool
            as a helpful companion, not a definitive source. Happy bird
            watching!
          </p>
        </footer>
      </div>
    </div>
  );
}
