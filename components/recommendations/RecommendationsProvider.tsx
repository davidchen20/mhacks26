"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  HALLS,
  getInitialRecommendations,
  validDate,
  getToday,
  getService,
  type Recommendation,
  type HistoryEntry,
  type Decision,
} from "@/lib/mockData";
const KEY = "wolverlean:recommendations:v2";
interface State {
  recommendations: Recommendation[];
  history: HistoryEntry[];
}
type Action =
  | { type: "load"; state: State }
  | { type: "create"; recommendation: Recommendation }
  | {
      type: "decide";
      id: string;
      decision: Decision;
      note: string;
      timestamp: string;
      historyId: string;
    }
  | { type: "reopen"; historyId: string; at: string };
const initial = (): State => ({
  recommendations: getInitialRecommendations(),
  history: [],
});
export function recommendationsReducer(state: State, action: Action): State {
  if (action.type === "load") return action.state;
  if (action.type === "create")
    return state.recommendations.some((r) => r.id === action.recommendation.id)
      ? state
      : {
          ...state,
          recommendations: [action.recommendation, ...state.recommendations],
        };
  if (action.type === "reopen")
    return {
      ...state,
      history: state.history.map((h) =>
        h.id === action.historyId && !h.reopenedAt
          ? { ...h, reopenedAt: action.at }
          : h,
      ),
    };
  const rec = state.recommendations.find((r) => r.id === action.id);
  if (
    !rec ||
    state.history.some(
      (h) => h.recommendation.id === action.id && !h.reopenedAt,
    )
  )
    return state;
  return {
    ...state,
    history: [
      {
        id: action.historyId,
        recommendation: rec,
        decision: action.decision,
        note: action.note.slice(0, 1000),
        timestamp: action.timestamp,
      },
      ...state.history,
    ],
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
function isRecommendation(v: unknown): v is Recommendation {
  return (
    object(v) &&
    typeof v.id === "string" &&
    typeof v.hallId === "string" &&
    HALLS.some((h) => h.id === v.hallId) &&
    typeof v.date === "string" &&
    validDate(v.date) &&
    ["breakfast", "brunch", "lunch", "dinner"].includes(String(v.meal)) &&
    ["itemId", "itemName", "title"].every((k) => typeof v[k] === "string") &&
    typeof v.remainingPct === "number" &&
    Number.isFinite(v.remainingPct) &&
    v.remainingPct >= 0 &&
    v.remainingPct <= 100 &&
    typeof v.wasteCost === "number" &&
    Number.isFinite(v.wasteCost) &&
    Array.isArray(v.reductionRange) &&
    v.reductionRange.length === 2 &&
    v.reductionRange.every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100,
    ) &&
    ["production", "nutrition"].includes(String(v.origin))
  );
}
export function parseStored(value: string): State | null {
  try {
    const v: unknown = JSON.parse(value);
    if (
      !object(v) ||
      v.version !== 2 ||
      !Array.isArray(v.recommendations) ||
      !Array.isArray(v.history) ||
      !v.recommendations.every(isRecommendation)
    )
      return null;
    const history: HistoryEntry[] = [];
    for (const h of v.history) {
      if (
        !object(h) ||
        typeof h.id !== "string" ||
        !isRecommendation(h.recommendation) ||
        !["Accepted", "Dismissed"].includes(String(h.decision)) ||
        typeof h.note !== "string" ||
        typeof h.timestamp !== "string" ||
        !Number.isFinite(Date.parse(h.timestamp)) ||
        (h.reopenedAt !== undefined &&
          (typeof h.reopenedAt !== "string" ||
            !Number.isFinite(Date.parse(h.reopenedAt))))
      )
        return null;
      history.push(h as unknown as HistoryEntry);
    }
    return {
      recommendations: [
        ...new Map(
          [
            ...getInitialRecommendations(),
            ...v.recommendations.filter(
              (r) =>
                r.date <= getToday() &&
                getService(r.hallId, r.date, r.meal).items.some(
                  (i) => i.id === r.itemId,
                ),
            ),
          ].map((r) => [r.id, r]),
        ).values(),
      ],
      history,
    };
  } catch {
    return null;
  }
}
interface ContextValue extends State {
  ready: boolean;
  storageAvailable: boolean;
  pending: Recommendation[];
  decide: (id: string, decision: Decision, note: string) => string;
  reopen: (historyId: string) => void;
  undo: (historyId: string) => void;
  create: (r: Recommendation) => void;
}
const Context = createContext<ContextValue | null>(null);
export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    recommendationsReducer,
    undefined,
    initial,
  );
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = parseStored(raw);
        if (parsed) dispatch({ type: "load", state: parsed });
      }
    } catch {
      setStorageAvailable(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 2, ...state }));
    } catch {
      setStorageAvailable(false);
    }
  }, [state, ready]);
  const pending = state.recommendations.filter(
    (r) =>
      !state.history.some((h) => h.recommendation.id === r.id && !h.reopenedAt),
  );
  const reopen = (historyId: string) =>
    dispatch({ type: "reopen", historyId, at: new Date().toISOString() });
  const value: ContextValue = {
    ...state,
    ready,
    storageAvailable,
    pending,
    create: (r) => dispatch({ type: "create", recommendation: r }),
    reopen,
    undo: (historyId) => {
      const h = state.history.find((h) => h.id === historyId);
      if (h && Date.now() - Date.parse(h.timestamp) <= 10000) reopen(historyId);
    },
    decide: (id, decision, note) => {
      const historyId = crypto.randomUUID();
      dispatch({
        type: "decide",
        id,
        decision,
        note,
        timestamp: new Date().toISOString(),
        historyId,
      });
      return historyId;
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useRecommendations() {
  const context = useContext(Context);
  if (!context) throw new Error("RecommendationsProvider is missing");
  return context;
}
