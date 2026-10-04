"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string };
type SpeechResult = { 0: { transcript: string }; isFinal: boolean };
type SpeechRecognitionEvent = Event & { results: ArrayLike<SpeechResult> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const initialMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I’m Grok. I can help explain the dashboards and discuss dining operations. What would you like to talk about?",
};

export default function GrokAssistant() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [speechOutputAvailable, setSpeechOutputAvailable] = useState(false);

  useEffect(() => {
    setSpeechOutputAvailable(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  function closeChat() {
    recognitionRef.current?.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    dialogRef.current?.close();
    setOpen(false);
  }

  function openChat() {
    dialogRef.current?.showModal();
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function speak(text: string) {
    if (!speechOutputAvailable) {
      setVoiceNotice("Speech output is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || "en-US";
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const speech = window as SpeechWindow;
    const SpeechRecognition =
      speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice("Voice input is not supported in this browser. You can still type to Grok.");
      return;
    }

    setVoiceNotice("Listening. Your browser may process speech using its own speech service.");
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) setDraft(transcript);
    };
    recognition.onerror = (event) => {
      setVoiceNotice(
        event.error === "not-allowed"
          ? "Microphone access was denied. You can still type to Grok."
          : "Voice input stopped. You can retry or type your message.",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setVoiceNotice((current) =>
        current.startsWith("Listening")
          ? "Voice input ready to send. Review the transcript, then choose Send."
          : current,
      );
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceNotice("Could not start voice input. Check microphone permission.");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const conversation = [
      ...messages.filter((message) => message.id !== "welcome"),
      userMessage,
    ].slice(-24);
    if (conversation[0]?.role === "assistant") conversation.shift();
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setError(null);
    setVoiceNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Grok request failed");
      if (typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("Grok returned an empty response.");
      }
      const answer = data.answer.trim();
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: answer },
      ]);
      if (speakReplies) speak(answer);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Grok is unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="fixed bottom-5 right-5 z-40 min-h-12 rounded-full border-2 border-navy bg-navy px-5 py-3 font-semibold text-white shadow-lg hover:bg-slate-800"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={open ? closeChat : openChat}
      >
        {open ? "Close Grok chat" : "Chat with Grok"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="grok-dialog-title"
        aria-describedby="grok-dialog-help"
        onClose={() => {
          setOpen(false);
          recognitionRef.current?.stop();
          triggerRef.current?.focus();
        }}
        onCancel={() => setOpen(false)}
        className="fixed inset-y-0 right-0 m-0 h-dvh max-h-none w-full max-w-lg border-0 bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/45"
      >
        <section className="flex h-full flex-col border-l border-slate-300 bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <h2 id="grok-dialog-title" className="text-xl font-semibold text-navy">
                Chat with Grok
              </h2>
              <p id="grok-dialog-help" className="muted mt-1">
                Ask a question or continue a conversation.
              </p>
            </div>
            <button type="button" className="btn" onClick={closeChat}>
              Close
            </button>
          </header>

          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
            role="log"
            aria-label="Conversation with Grok"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[92%] rounded-2xl border border-navy bg-slate-100 p-4"
                    : "mr-auto max-w-[92%] rounded-2xl border border-slate-200 bg-white p-4"
                }
              >
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {message.role === "user" ? "You" : "Grok"}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                  {message.content}
                </p>
                {message.role === "assistant" && speechOutputAvailable && (
                  <button
                    type="button"
                    className="mt-3 min-h-10 text-sm font-semibold text-navy underline"
                    onClick={() => speak(message.content)}
                  >
                    Speak this response
                  </button>
                )}
              </article>
            ))}
            {busy && (
              <p role="status" className="muted">
                Grok is responding…
              </p>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-slate-200 p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn"
                aria-pressed={listening}
                onClick={toggleListening}
              >
                {listening ? "Stop listening" : "Use voice"}
              </button>
              {speechOutputAvailable && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => window.speechSynthesis.cancel()}
                >
                  Stop speaking
                </button>
              )}
              <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-navy"
                  checked={speakReplies}
                  onChange={(event) => setSpeakReplies(event.target.checked)}
                  disabled={!speechOutputAvailable}
                />
                Speak Grok replies
              </label>
            </div>
            <p role="status" aria-live="polite" className="muted mb-3">
              {voiceNotice ||
                "Microphone is used only after you choose Use voice. Review dictated text before sending."}
            </p>
            {error && (
              <p
                role="alert"
                className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
              >
                {error}
              </p>
            )}
            <form onSubmit={sendMessage} className="space-y-3">
              <label htmlFor="grok-message" className="text-sm font-semibold">
                Message
              </label>
              <textarea
                ref={inputRef}
                id="grok-message"
                className="input min-h-24 resize-y"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4000}
                placeholder="Type or dictate a message"
                disabled={busy}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="muted">{draft.length}/4000 · Shift+Enter for a new line</p>
                <button
                  type="submit"
                  className="btn btn-primary min-w-24"
                  disabled={busy || !draft.trim()}
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
            <p className="muted mt-4 border-t border-slate-100 pt-3">
              Messages are sent to the Grok API. Dictation is processed by your
              browser’s speech service. This conversation is kept in this tab
              only.
            </p>
          </div>
        </section>
      </dialog>
    </>
  );
}
