import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ask, getHistory, getStoredSession, newConversation } from "../api/chat";
import { ApiError } from "../api/client";
import { useHealth } from "../api/hooks";
import { useLang } from "../i18n/LangContext";
import Markdown from "./Markdown";
import { errorText } from "./ui";

const MAX_LEN = 2000;
let uid = 0;
const nextId = () => ++uid;

/**
 * AI-chat oynasi (FRONTEND_API.md §3).
 * variant="hero" — landing'dagi ixcham ko'rinish, variant="page" — to'liq sahifa.
 */
export default function ChatPanel({ variant = "page" }) {
  const { t } = useLang();
  const health = useHealth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [includeTrace, setIncludeTrace] = useState(false);
  const [disabled503, setDisabled503] = useState(false);
  const bodyRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const agentOff = disabled503 || health.data?.agent_available === false;

  // Saqlangan sessiya tarixini tiklash
  useEffect(() => {
    const sid = getStoredSession();
    if (!sid) return;
    let alive = true;
    getHistory(sid)
      .then((h) => {
        if (!alive || !h?.messages?.length) return;
        setMessages(
          h.messages.flatMap((m) => [
            { id: nextId(), role: "user", text: m.question },
            { id: nextId(), role: "bot", text: m.answer },
          ]),
        );
      })
      .catch(() => {
        /* sessiya o'chgan bo'lsa — keyingi savolda avtomatik yangilanadi */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(
    async (question, { addUser = true } = {}) => {
      const q = question.trim();
      if (!q || loading || agentOff) return;
      if (addUser) setMessages((m) => [...m, { id: nextId(), role: "user", text: q }]);
      setInput("");
      setLoading(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const { res, sessionReset } = await ask(q, { includeTrace, signal: ctrl.signal });
        setMessages((m) => [
          ...m,
          ...(sessionReset ? [{ id: nextId(), role: "notice", text: t.chat.sessionReset }] : []),
          { id: nextId(), role: "bot", text: res.answer, toolCalls: res.tool_calls, duration: res.duration_sec, trace: res.trace },
        ]);
      } catch (e) {
        if (ctrl.signal.aborted && !(e instanceof ApiError)) return; // komponent yopildi
        if (e instanceof ApiError && e.status === 503) {
          setDisabled503(true);
          health.refetch();
        }
        setMessages((m) => [...m, { id: nextId(), role: "error", question: q, error: e }]);
      } finally {
        setLoading(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [loading, agentOff, includeTrace, t, health],
  );

  const retry = (msg) => {
    setMessages((m) => m.filter((x) => x.id !== msg.id));
    send(msg.question, { addUser: false });
  };

  const reset = () => {
    abortRef.current?.abort();
    newConversation();
    setMessages([]);
    setLoading(false);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const isHero = variant === "hero";

  return (
    <div className={`chat chat--${variant}`}>
      <div className="chat__head">
        <div className="chat__title">
          <span aria-hidden="true" className={`chat__dot${agentOff ? " chat__dot--off" : ""}`} />
          <span>{t.chat.title}</span>
        </div>
        <div className="chat__tools">
          {!isHero && (
            <label className="check" style={{ minHeight: 32 }}>
              <input type="checkbox" checked={includeTrace} onChange={(e) => setIncludeTrace(e.target.checked)} />
              {t.chat.traceToggle}
            </label>
          )}
          {messages.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              {t.chat.newChat}
            </button>
          )}
          {isHero ? (
            <Link to="/chat" className="btn btn--ghost btn--sm">
              {t.chat.fullscreen}
            </Link>
          ) : (
            <span>{t.chat.hint}</span>
          )}
        </div>
      </div>

      <div className="chat__body" ref={bodyRef} aria-live="polite">
        {agentOff && (
          <div className="alert alert--warn" role="status">
            {t.chat.unavailable}
          </div>
        )}
        {messages.length === 0 && !agentOff && (
          <div className="chat__empty">
            <h3>{t.chat.emptyTitle}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {t.chat.emptySub}
            </p>
          </div>
        )}
        {messages.map((m) => {
          if (m.role === "user")
            return (
              <div key={m.id} className="msg-user">
                {m.text}
              </div>
            );
          if (m.role === "notice")
            return (
              <div key={m.id} className="alert alert--info" role="status">
                {m.text}
              </div>
            );
          if (m.role === "error") return <ChatError key={m.id} msg={m} onRetry={() => retry(m)} />;
          return <BotMessage key={m.id} msg={m} />;
        })}
        {loading && (
          <div className="typing" role="status">
            <span className="spinner" aria-hidden="true" /> {t.chat.typing}
          </div>
        )}
      </div>

      <form className="chat__form" onSubmit={onSubmit}>
        {messages.length === 0 && (
          <div className="chat__chips">
            {t.chat.samples.map((s) => (
              <button key={s} type="button" className="chip" disabled={loading || agentOff} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="chat__row">
          <label htmlFor={`ask-${variant}`} className="sr-only">
            {t.chat.inputLabel}
          </label>
          <textarea
            id={`ask-${variant}`}
            ref={inputRef}
            className="chat__input"
            rows={1}
            maxLength={MAX_LEN}
            value={input}
            disabled={agentOff}
            placeholder={t.chat.placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="submit" className="btn btn--primary chat__send" disabled={loading || agentOff || !input.trim()}>
            <span>{t.chat.send}</span>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        {input.length > MAX_LEN * 0.8 && (
          <div className="chat__counter">
            {input.length} / {MAX_LEN}
          </div>
        )}
      </form>
    </div>
  );
}

function BotMessage({ msg }) {
  const { t } = useLang();
  return (
    <div className="msg-bot">
      <Markdown text={msg.text} />
      {msg.toolCalls != null && <div className="msg-meta">{t.chat.meta(msg.toolCalls, msg.duration)}</div>}
      {msg.trace?.length > 0 && (
        <details className="trace">
          <summary>{t.chat.trace}</summary>
          {msg.trace.map((tr, i) => (
            <div key={i} className="trace__item">
              <div>
                <span className="kind">{tr.tool}</span>
                {tr.args?.purpose && (
                  <span>
                    {" "}
                    · {t.chat.purpose}: {String(tr.args.purpose)}
                  </span>
                )}
                {tr.row_count != null && (
                  <span className="muted">
                    {" "}
                    · {tr.row_count} {t.chat.rows}
                  </span>
                )}
                {tr.result?.truncated && <span className="muted"> · {t.chat.truncated}</span>}
              </div>
              {tr.args?.sql && <pre>{String(tr.args.sql)}</pre>}
              {tr.args?.query && !tr.args?.sql && <pre>{String(tr.args.query)}</pre>}
              {tr.error && <div className="alert alert--error">{tr.error}</div>}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function ChatError({ msg, onRetry }) {
  const { t } = useLang();
  const e = msg.error;
  const is502 = e instanceof ApiError && e.status === 502;
  const is503 = e instanceof ApiError && e.status === 503;
  const text = is502 ? t.chat.err502 : is503 ? t.chat.unavailable : errorText(e, t);
  return (
    <div className="alert alert--error" role="alert">
      <div>
        {text}
        {e instanceof ApiError && e.requestId && (
          <small>
            {t.common.requestId}: {e.requestId}
          </small>
        )}
      </div>
      {!is503 && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          {t.common.retry}
        </button>
      )}
    </div>
  );
}
