"use client";
import { useEffect, useRef, useState } from "react";
type Message = {role: "user" | "model"; text: string};
const chips = ["What was today's tofu waste?", "Which hall wasted the most chicken?", "Give me a quick sustainability tip"];
export default function Chatbot() {
  const [open, setOpen] = useState(false), [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null), end = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null), inFlight = useRef(false);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if(open) end.current?.scrollIntoView({block: "nearest"}); }, [messages, busy, open]);
  useEffect(() => () => controller.current?.abort(), []);
  function close() { setOpen(false); trigger.current?.focus(); }
  async function send(value: string) {
    if (!value.trim() || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const next: Message[] = [...messages, {role: "user", text: value.trim()}];
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/chat", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({messages: next.slice(-19)}), signal: controller.current.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat is unavailable. Please retry.");
      setMessages([...next, {role: "model", text: data.reply}]); setText("");
    } catch (e) { setError(e instanceof Error ? e.message : "Chat is unavailable."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
    {open && <section id="dining-chat" role="dialog" aria-modal="false" aria-labelledby="chat-title" className="panel flex max-h-[calc(100dvh-6rem)] w-[380px] max-w-full flex-col p-4" onKeyDown={e => {if(e.key === "Escape") close();}}>
      <header className="flex items-start justify-between gap-3"><div><h2 id="chat-title" className="section-title">Dining copilot</h2><p className="muted">Powered by GrokAI</p></div><button className="btn" aria-label="Close dining chat" onClick={close}>×</button></header>
      <p className="muted my-2">Waste readings are simulated. Review advice before changing production.</p>
      <div role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions" className="min-h-20 overflow-y-auto">
        {messages.map((m,i) => <div key={i} className="my-3 rounded-lg border border-slate-200 p-3"><strong>{m.role === "user" ? "You" : "Copilot"}</strong><p className="whitespace-pre-wrap text-sm">{m.text}</p></div>)}<div ref={end}/>
      </div>
      <p role="status" className="muted">{busy ? "Thinking…" : ""}</p>{error && <p role="alert" className="my-2 text-sm">{error} Your message was kept; try again.</p>}
      {messages.length === 0 && (<div className="my-3 flex flex-wrap gap-2" aria-label="Suggested questions">{chips.map(chip => <button key={chip} className="btn text-[13px]" disabled={busy} onClick={() => {setText(chip); input.current?.focus();}}>{chip}</button>)}</div>)}
      <form className="flex gap-2" onSubmit={e => {e.preventDefault(); void send(text);}}><label className="sr-only" htmlFor="chat-input">Ask the dining copilot</label><input id="chat-input" ref={input} className="input" value={text} maxLength={2000} onChange={e => setText(e.target.value)} placeholder="Ask about food waste…"/><button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button></form>
    </section>}
    <button ref={trigger} className="btn btn-primary shadow-lg" aria-label={open ? "Close dining copilot" : "Open dining copilot"} aria-expanded={open} aria-controls="dining-chat" onClick={() => open ? close() : setOpen(true)}> {open ? "Close chat" : "Ask dining copilot"}</button>
  </div>;
}
