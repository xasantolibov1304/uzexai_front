import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ApiError, askChat, endChat, fetchHealth, isMock, MAX_QUESTION_LENGTH as MAX_LENGTH, restoreChat } from "./api.js";
import { LANGS, useLang } from "./i18n.jsx";
import Prism from "./Prism.jsx";
import AnswerChart from "./Chart.jsx";
import Sources from "./Sources.jsx";
import { ThinkingLabel, useReveal } from "./reveal.jsx";

const EXAMPLE_MS = 3500;
const FOLLOW_DISTANCE = 160;

let nextId = 0;
const newId = () => ++nextId;

const LONG_CELL = 60;
const nodeText = (node) => node.value ?? (node.children || []).map(nodeText).join("");

const MD_COMPONENTS = {
  table: ({ node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
  // Cells stay on one line, except real sentences, which would make the table huge.
  td: ({ node, ...props }) => (
    <td {...props} className={nodeText(node).length > LONG_CELL ? "cell--long" : undefined} />
  ),
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
};

function errorText(err, t) {
  if (!(err instanceof ApiError)) return err?.message || t.error;
  if (err.status === 0) return err.detail === "timeout" ? t.timeout : t.network;
  if (err.status === 401) return t.unauthorized;
  if (err.status === 502) return t.err502;
  if (err.status === 503) return t.unavailable;
  return err.message || t.error;
}

export default function Chat() {
  const { t, lang, setLang } = useLang();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [preview, setPreview] = useState(null); // { messageId, dataset }: one panel across all answers
  const [exampleIndex, setExampleIndex] = useState(0);
  const bodyRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((h) => {
        if (h?.agent_available === false) setDisabled(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    restoreChat()
      .then((session) => {
        if (!active || !session?.messages?.length) return;
        setMessages(
          session.messages.flatMap((m) => [
            { id: newId(), role: "user", text: m.question },
            { id: newId(), role: "bot", text: m.answer },
          ])
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Keep the growing answer in view, unless the reader has scrolled up to something else.
  const followReveal = () => {
    const el = bodyRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_DISTANCE) el.scrollTop = el.scrollHeight;
  };

  // Rotate the example question while the input is empty; hold still for reduced motion.
  useEffect(() => {
    if (draft || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => setExampleIndex((i) => i + 1), EXAMPLE_MS);
    return () => clearInterval(timer);
  }, [draft]);

  // Grow the composer with its text, up to the CSS max-height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const send = useCallback(
    async (text, { addUser = true } = {}) => {
      const question = text.trim();
      if (!question || sending || disabled) return;
      if (addUser) setMessages((prev) => [...prev, { id: newId(), role: "user", text: question }]);
      setDraft("");
      setSending(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { res, sessionReset } = await askChat(question, { signal: controller.signal });
        setMessages((prev) => [
          ...prev,
          ...(sessionReset ? [{ id: newId(), role: "notice", key: "sessionReset" }] : []),
          {
            id: newId(),
            role: "bot",
            text: res.answer,
            reveal: true,
            toolCalls: res.tool_calls,
            duration: res.duration_sec,
            trace: res.trace,
          },
        ]);
      } catch (err) {
        if (controller.signal.aborted && !(err instanceof ApiError)) return;
        if (err instanceof ApiError && err.status === 503) setDisabled(true);
        setMessages((prev) => [...prev, { id: newId(), role: "error", question, error: err }]);
      } finally {
        setSending(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [sending, disabled]
  );

  const retry = (msg) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    send(msg.question, { addUser: false });
  };

  const startOver = () => {
    abortRef.current?.abort();
    endChat();
    setMessages([]);
    setPreview(null);
    setSending(false);
    inputRef.current?.focus();
  };

  const currentExample = t.examples[exampleIndex % t.examples.length];

  // The examples read as the end of a sentence after the prefix, so the question itself needs a capital.
  const useExample = () => {
    setDraft(currentExample.charAt(0).toUpperCase() + currentExample.slice(1));
    inputRef.current?.focus();
  };

  // Ready to type on arrival. Not on touch screens, where focus would pop up the keyboard.
  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Tab is meant to work whether the cursor is in the input or the user clicked an empty part of
  // the page. Anything else focused keeps normal Tab order, and Shift+Tab always moves back.
  const tabRef = useRef(null);
  tabRef.current = (e) => {
    if (e.key !== "Tab" || e.shiftKey || draft || disabled || preview) return;
    const active = document.activeElement;
    if (active !== inputRef.current && active !== document.body) return;
    e.preventDefault();
    useExample();
  };
  useEffect(() => {
    const onKey = (e) => tabRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  const empty = messages.length === 0 && !sending;

  return (
    <div className={`sheet${preview ? " sheet--preview" : ""}`}>
      <Prism />
      <header className="topbar">
        <div className="brand">
          Birja<span>·</span>AI
          {isMock && <b className="demo-badge">DEMO</b>}
        </div>
        <div className="langs" role="group" aria-label="Language">
          {LANGS.map(([code, label]) => (
            <button
              key={code}
              type="button"
              aria-pressed={code === lang}
              onClick={() => setLang(code)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="body" ref={bodyRef} aria-live="polite">
        {disabled && (
          <div className="alert alert--warn thread" role="status">
            {t.unavailable}
          </div>
        )}

        {empty ? (
          <div className="welcome">
            <h1>{t.heading}</h1>
            <div className="cards">
              {Object.entries(t.cards).map(([key, card]) => (
                <button
                  key={key}
                  type="button"
                  className="card"
                  disabled={disabled}
                  onClick={() => send(card.ask)}
                >
                  <span className="card__art" aria-hidden="true">
                    <CardArt kind={key} />
                  </span>
                  <span className="card__title">{card.title}</span>
                  <span className="card__desc">{card.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="thread">
            {messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className="msg-user">
                    {m.text}
                  </div>
                );
              }
              if (m.role === "notice") {
                return (
                  <div key={m.id} className="alert" role="status">
                    {t[m.key]}
                  </div>
                );
              }
              if (m.role === "error") {
                return <ErrorMessage key={m.id} msg={m} onRetry={() => retry(m)} />;
              }
              return (
                <BotMessage
                  key={m.id}
                  msg={m}
                  onProgress={followReveal}
                  selected={preview?.messageId === m.id ? preview.dataset : null}
                  onSelect={(dataset) => setPreview(dataset ? { messageId: m.id, dataset } : null)}
                />
              );
            })}
            {sending && (
              <div className="typing" role="status">
                <span className="typing__ring" aria-hidden="true" />
                <ThinkingLabel />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="dock">
        <form
          className={`composer${messages.length === 0 ? " composer--solo" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          {messages.length > 0 && (
            <button
              type="button"
              className="round"
              title={t.newChat}
              aria-label={t.newChat}
              onClick={startOver}
            >
              <svg {...ICON}>
                <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
                <path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 16l1.4-4z" />
              </svg>
            </button>
          )}
          <label htmlFor="ask" className="sr-only">
            {t.inputLabel}
          </label>
          <div className="composer__field">
            <textarea
              id="ask"
              ref={inputRef}
              rows={1}
              maxLength={MAX_LENGTH}
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {!draft && (
              <>
                <span className="composer__hint" aria-hidden="true">
                  <span className="composer__hint-prefix">{t.examplePrefix}</span>
                  <span className="composer__hint-text" key={`${lang}-${exampleIndex}`}>
                    {currentExample}
                  </span>
                </span>
                {!disabled && (
                  <button
                    type="button"
                    className="composer__use"
                    title={t.useExample}
                    aria-label={`${t.useExample}: ${currentExample}`}
                    onClick={useExample}
                  >
                    <span className="composer__use-key">Tab</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 0 5-5V5" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
          <button
            type="submit"
            className="round round--send"
            title={t.send}
            aria-label={t.send}
            disabled={sending || disabled || !draft.trim()}
          >
            <svg {...ICON}>
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </button>
        </form>
        {draft.length > MAX_LENGTH * 0.8 && (
          <div className="dock__note">
            {draft.length} / {MAX_LENGTH}
          </div>
        )}
        <div className="dock__note">{t.testData}</div>
      </footer>
    </div>
  );
}

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function BotMessage({ msg, selected, onSelect, onProgress }) {
  const { t } = useLang();
  const { text, done } = useReveal(msg.text, msg.reveal, onProgress);
  return (
    <div className="msg-bot">
      <div className="md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={MD_COMPONENTS}
        >
          {text}
        </ReactMarkdown>
      </div>
      {done && (
        <div className="msg-after">
          <AnswerChart steps={msg.trace} answer={msg.text} />
          {msg.toolCalls != null && <div className="msg-meta">{t.meta(msg.toolCalls, msg.duration)}</div>}
          <Sources steps={msg.trace} selected={selected} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function ErrorMessage({ msg, onRetry }) {
  const { t } = useLang();
  const { error } = msg;
  const isApi = error instanceof ApiError;
  return (
    <div className="alert alert--error" role="alert">
      <div>
        {errorText(error, t)}
        {isApi && error.requestId && (
          <small>
            {t.requestId}: {error.requestId}
          </small>
        )}
      </div>
      {!(isApi && error.status === 503) && (
        <button type="button" className="alert__action" onClick={onRetry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}

const delay = (seconds) => ({ "--d": `${seconds}s` });

function CardArt({ kind }) {
  if (kind === "products") {
    // Podium: the ranking the question asks for.
    return (
      <svg className="art" viewBox="0 0 150 92">
        <defs>
          <linearGradient id="art-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c4e2f2" />
            <stop offset="1" stopColor="#eaf4f9" />
          </linearGradient>
          <linearGradient id="art-peach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8d3b4" />
            <stop offset="1" stopColor="#fcefe4" />
          </linearGradient>
        </defs>
        <path
          className="art-spark"
          style={delay(0.42)}
          d="M75 2c.9 4.6 2.4 6.1 7 7-4.6.9-6.1 2.4-7 7-.9-4.6-2.4-6.1-7-7 4.6-.9 6.1-2.4 7-7z"
          fill="#eea25a"
        />
        {/* Builds from third place up to first. */}
        <rect className="art-grow" style={delay(0.12)} x="14" y="42" width="38" height="48" rx="10" fill="url(#art-sky)" />
        <rect className="art-grow" style={delay(0.24)} x="56" y="22" width="38" height="68" rx="10" fill="#171717" />
        <rect className="art-grow" x="98" y="56" width="38" height="34" rx="10" fill="url(#art-peach)" />
        <text x="33" y="63" className="art__num art-fade" style={delay(0.3)}>2</text>
        <text x="75" y="44" className="art__num art-fade" style={delay(0.42)} fill="#fff">1</text>
        <text x="117" y="77" className="art__num art-fade" style={delay(0.18)}>3</text>
      </svg>
    );
  }
  if (kind === "buyers") {
    // One seller, several buyers; line weight stands for traded volume.
    return (
      <svg className="art" viewBox="0 0 150 92">
        <g fill="none" strokeLinecap="round">
          <path className="art-draw" style={delay(0.2)} pathLength="1" d="M40 46C76 46 76 76 116 76" stroke="#dcdcd9" strokeWidth="2.5" />
          <path className="art-draw" style={delay(0.1)} pathLength="1" d="M40 46H122" stroke="#a9d6ee" strokeWidth="4" />
          <path className="art-draw" pathLength="1" d="M40 46C76 46 76 16 112 16" stroke="#f4b57c" strokeWidth="7" />
        </g>
        <circle cx="26" cy="46" r="19" fill="#171717" />
        <rect x="19" y="35" width="14" height="22" rx="2.5" fill="#fff" />
        <g fill="#171717">
          <rect x="22" y="39" width="3" height="3" rx=".6" />
          <rect x="27" y="39" width="3" height="3" rx=".6" />
          <rect x="22" y="45" width="3" height="3" rx=".6" />
          <rect x="27" y="45" width="3" height="3" rx=".6" />
          <rect x="24.5" y="51" width="3" height="6" rx=".6" />
        </g>
        <g stroke="#fff" strokeWidth="3">
          <circle className="art-pop" style={delay(0.42)} cx="122" cy="16" r="14" fill="#f4b57c" />
          <circle className="art-pop" style={delay(0.5)} cx="131" cy="46" r="11.5" fill="#a9d6ee" />
          <circle className="art-pop" style={delay(0.58)} cx="122" cy="76" r="9.5" fill="#e4e4e1" />
        </g>
      </svg>
    );
  }
  // Two years on one axis.
  return (
    <svg className="art" viewBox="0 0 150 92">
      <g stroke="#ececea" strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round">
        <path d="M6 24H112M6 46H112M6 68H112" />
      </g>
      <path
        className="art-draw art-draw--slow"
        pathLength="1"
        d="M6 58C28 48 42 30 60 36S92 62 112 46"
        fill="none"
        stroke="#c6c6c3"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        className="art-draw art-draw--slow"
        style={delay(0.15)}
        pathLength="1"
        d="M6 76C26 74 40 60 58 58S88 32 112 22"
        fill="none"
        stroke="#171717"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle className="art-pop" style={delay(0.62)} cx="112" cy="46" r="4.5" fill="#c6c6c3" stroke="#fff" strokeWidth="2" />
      <circle className="art-pop" style={delay(0.76)} cx="112" cy="22" r="6" fill="#171717" stroke="#fff" strokeWidth="2" />
      <text x="122" y="26" className="art__label art__label--on art-fade" style={delay(0.82)}>2025</text>
      <text x="122" y="50" className="art__label art-fade" style={delay(0.68)}>2024</text>
    </svg>
  );
}
