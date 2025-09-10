import React, { useEffect, useMemo, useState, useCallback } from "react";

// ====== DỮ LIỆU BÀN CỜ ======
const SIZE = 6; // lưới 6x6 -> 20 ô viền
const TILES = [
  { type: "start", name: "Xuất phát" }, // 0
  { type: "property", name: "Phố A", price: 120, rent: 35, color: "#ef4444" },
  { type: "chance", name: "Cơ hội" }, // 2
  { type: "property", name: "Phố B", price: 140, rent: 40, color: "#f97316" },
  { type: "tax", name: "Thuế $100", amount: 100 },
  { type: "property", name: "Phố C", price: 160, rent: 45, color: "#f59e0b" },
  { type: "chance", name: "Cơ hội" }, // 6
  { type: "property", name: "Phố D", price: 180, rent: 50, color: "#10b981" },
  { type: "jail", name: "Nhà tù (mất 1 lượt)" },
  { type: "property", name: "Phố E", price: 200, rent: 60, color: "#14b8a6" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố F", price: 220, rent: 70, color: "#06b6d4" },
  { type: "tax", name: "Thuế $100", amount: 100 },
  { type: "property", name: "Phố G", price: 240, rent: 80, color: "#60a5fa" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố H", price: 260, rent: 90, color: "#818cf8" },
  { type: "free", name: "Bãi đỗ miễn phí" },
  { type: "property", name: "Phố I", price: 280, rent: 100, color: "#a78bfa" },
  { type: "chance", name: "Cơ hội" },
  { type: "property", name: "Phố J", price: 300, rent: 110, color: "#f472b6" },
];

const CHANCE = [
  {
    text: "Nhận thưởng dự án +$200",
    do: (s) => ({
      ...s,
      money: s.money + 200,
      log: ["Bạn nhận +$200.", ...s.log],
    }),
  },
  {
    text: "Đóng phạt giao thông -$150",
    do: (s) => ({
      ...s,
      money: s.money - 150,
      log: ["Bạn mất -$150.", ...s.log],
    }),
  },
  { text: "Tiến lên 3 ô", do: (s, helpers) => helpers.moveBy(3, true) },
  { text: "Lùi 2 ô", do: (s, helpers) => helpers.moveBy(-2, true) },
  {
    text: "Về Xuất phát và nhận +$200",
    do: (s, helpers) => helpers.goTo(0, true),
  },
  { text: "Vào Nhà tù (mất 1 lượt)", do: (s, helpers) => helpers.goToJail() },
];

const DEFAULT = {
  pos: 0,
  money: 1500,
  turn: 0,
  laps: 0,
  owned: {},
  skip: 0,
  canRoll: true,
  pendingBuy: null,
  lastRoll: null,
  bankrupt: false,
  action: "Sẵn sàng! Quay để bắt đầu.",
  log: [],
};
const KEY = "co-ty-phu-mini-react-v1";

function useLocalState() {
  const [state, setState] = useState(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v ? JSON.parse(v) : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);
  return [state, setState];
}

function indexToCoord(i) {
  const s = SIZE; // 6
  if (i < s) return { row: 1, col: i + 1 }; // hàng trên
  if (i < s + (s - 1)) {
    const k = i - s;
    return { row: k + 2, col: s };
  }
  if (i < s + (s - 1) + (s - 1)) {
    const k = i - (s + (s - 1));
    return { row: s, col: s - 1 - k };
  }
  const k = i - (s + (s - 1) + (s - 1));
  return { row: s - 1 - k, col: 1 };
}

export default function MonopolySolo() {
  const [state, setState] = useLocalState();

  const helpers = useMemo(
    () => ({
      moveBy: (steps, fromCard = false) => {
        setState((prev) => {
          const N = TILES.length;
          let old = prev.pos;
          let next = (old + steps) % N;
          if (next < 0) next += N;
          let laps = prev.laps;
          let money = prev.money;
          if (steps > 0 && old + steps >= N) {
            laps++;
            money += 200;
          }
          const newState = { ...prev, pos: next, laps, money };
          return handleLanding(newState, fromCard);
        });
      },
      goTo: (idx, rewardStart = false) => {
        setState((prev) => {
          let money = prev.money;
          let laps = prev.laps;
          if (rewardStart && idx === 0) {
            laps++;
            money += 200;
          }
          const newState = { ...prev, pos: idx, money, laps };
          return handleLanding(newState, true);
        });
      },
      goToJail: () => {
        setState((prev) => {
          const s = { ...prev, pos: 8, skip: 1 };
          return {
            ...s,
            action: "Bạn vào Nhà tù và mất 1 lượt.",
            log: ["Bạn vào Nhà tù và mất 1 lượt.", ...s.log],
          };
        });
      },
    }),
    []
  );

  const handleLanding = useCallback(
    (s, fromCard = false) => {
      const tile = TILES[s.pos];
      let next = { ...s };
      switch (tile.type) {
        case "start":
          next.action = "Bạn đang ở ô Xuất phát.";
          break;
        case "property":
          if (next.owned[s.pos]) {
            next.action = `Bạn đã sở hữu ${tile.name}.`;
          } else {
            next.pendingBuy = s.pos;
            next.action = `${tile.name}: Giá $${tile.price}, thuê $${tile.rent}. Mua chứ?`;
          }
          break;
        case "chance": {
          const card = CHANCE[Math.floor(Math.random() * CHANCE.length)];
          next.action = `Cơ hội: ${card.text}`;
          next.log = [`Cơ hội: ${card.text}`, ...next.log];
          // thẻ có thể trả state mới hoặc gọi helpers
          const result = card.do;
          if (result.length === 2) {
            // có helpers
            setTimeout(() => result(next, helpers), 0);
          } else {
            next = result(next);
          }
          break;
        }
        case "tax":
          next.money -= tile.amount || 100;
          next.action = `Bạn nộp thuế $${tile.amount || 100}.`;
          next.log = [`Thuế -$${tile.amount || 100}`, ...next.log];
          break;
        case "jail":
          next.skip = 1;
          next.action = "Bạn vào Nhà tù: mất 1 lượt.";
          next.log = ["Mất 1 lượt.", ...next.log];
          break;
        case "free":
          next.action = "Bãi đỗ miễn phí: không có sự kiện.";
          break;
      }
      if (next.money < 0) {
        next.bankrupt = true;
        next.canRoll = false;
        next.action = "Bạn đã phá sản! Bấm 'Chơi mới' để bắt đầu lại.";
        next.log = ["💥 Phá sản.", ...next.log];
      }
      return next;
    },
    [helpers]
  );

  const roll = useCallback(() => {
    setState((prev) => {
      if (!prev.canRoll || prev.bankrupt) return prev;
      if (prev.skip > 0) {
        return {
          ...prev,
          skip: prev.skip - 1,
          turn: prev.turn + 1,
          lastRoll: "—",
          action: "Bỏ lượt do đang ở Nhà tù.",
          log: ["Bị giữ, bỏ lượt.", ...prev.log],
        };
      }
      const n = Math.floor(Math.random() * 6) + 1;
      const after = { ...prev, lastRoll: n, canRoll: false };
      // di chuyển ở tick kế tiếp để UI mượt
      setTimeout(() => helpers.moveBy(n), 200);
      return { ...after, turn: after.turn + 1, canRoll: true };
    });
  }, [helpers]);

  const attemptBuy = () => {
    setState((s) => {
      const idx = s.pendingBuy;
      if (idx == null) return s;
      const t = TILES[idx];
      if (s.money >= t.price) {
        const money = s.money - t.price;
        const owned = { ...s.owned, [idx]: true };
        return {
          ...s,
          money,
          owned,
          pendingBuy: null,
          action: `Đã mua ${t.name}.`,
          log: [`Mua ${t.name} với $${t.price}.`, ...s.log],
        };
      } else {
        return {
          ...s,
          action: "Không đủ tiền để mua.",
          log: ["Mua thất bại: thiếu tiền.", ...s.log],
        };
      }
    });
  };

  const skipBuy = () => {
    setState((s) => {
      const idx = s.pendingBuy;
      if (idx == null) return s;
      const t = TILES[idx];
      const money = s.money - t.rent;
      let next = {
        ...s,
        money,
        pendingBuy: null,
        action: `Bạn bỏ qua. Trừ $${t.rent}.`,
        log: [`Không mua ${t.name} → trả tiền thuê $${t.rent}.`, ...s.log],
      };
      if (next.money < 0) {
        next.bankrupt = true;
        next.canRoll = false;
        next.log = ["💥 Phá sản.", ...next.log];
        next.action = "Bạn đã phá sản!";
      }
      return next;
    });
  };

  const reset = () => setState(DEFAULT);
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  };
  const load = () => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setState(JSON.parse(v));
    } catch {}
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        roll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roll]);

  // dựng lưới 6x6
  const grid = useMemo(() => {
    const cells = new Array(SIZE * SIZE)
      .fill(null)
      .map((_, i) => ({ i, tile: null }));
    TILES.forEach((t, idx) => {
      const { row, col } = indexToCoord(idx);
      const index = (row - 1) * SIZE + (col - 1);
      cells[index] = { i: index, tile: { ...t, idx } };
    });
    return cells;
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0b1220] to-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="grid gap-5 w-full max-w-[1200px] md:grid-cols-[1.1fr_0.9fr]">
        {/* Board */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-600/20 p-4 shadow-xl">
          <div className="flex items-center gap-2 font-bold mb-3">
            <span>🎲</span>
            <span>Cờ Tỷ Phú Mini · Solo (React)</span>
          </div>
          <div
            className="mx-auto grid gap-1"
            style={{
              width: "min(92vw,680px)",
              height: "min(92vw,680px)",
              gridTemplateColumns: `repeat(${SIZE},minmax(0,1fr))`,
              gridTemplateRows: `repeat(${SIZE},minmax(0,1fr))`,
            }}
          >
            {grid.map((cell) => {
              const t = cell.tile;
              const isCurrent = t && t.idx === state.pos;
              const owned = t && state.owned[t.idx];
              return (
                <div
                  key={cell.i}
                  className={`relative rounded-xl border ${
                    t
                      ? "bg-slate-900/80 border-slate-600/30"
                      : "bg-transparent border-transparent"
                  } overflow-hidden`}
                  style={{
                    outline: t
                      ? t.type === "property"
                        ? owned
                          ? "2px solid rgba(34,211,238,.8)"
                          : "1px solid rgba(148,163,184,.25)"
                        : "1px dashed rgba(148,163,184,.35)"
                      : "none",
                  }}
                >
                  {t && (
                    <div className="flex flex-col justify-between h-full p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">
                          #{t.idx}
                        </span>
                        <span className="leading-tight">{t.name}</span>
                      </div>
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          background:
                            t.type === "property"
                              ? t.color
                              : "rgba(148,163,184,.15)",
                        }}
                      />
                      <div className="opacity-80">
                        {t.type === "property"
                          ? `$${t.price} · thuê $${t.rent}`
                          : ""}
                      </div>
                      {isCurrent && (
                        <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,.7)]" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Mẹo: Nhấn <b>Space</b> để quay xúc xắc. Game tự lưu vào trình duyệt.
          </p>
        </div>

        {/* Control panel */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-600/20 p-4 shadow-xl">
          <div className="font-bold mb-2">Bảng điều khiển</div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-300 mb-2">
            <span className="px-2 py-1 rounded-full bg-slate-600/20">
              Xúc xắc: <b className="ml-1">{state.lastRoll ?? "—"}</b>
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-600/20">
              Bỏ lượt còn: <b className="ml-1">{state.skip}</b>
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-600/20">
              Sở hữu: <b className="ml-1">{Object.keys(state.owned).length}</b>{" "}
              ô
            </span>
          </div>
          <div className="flex flex-wrap gap-2 my-2">
            <button
              onClick={roll}
              disabled={!state.canRoll || state.bankrupt}
              className="px-4 py-2 rounded-xl font-semibold bg-cyan-400 text-slate-900 shadow"
            >
              Quay xúc xắc
            </button>
            {state.pendingBuy != null && (
              <>
                <button
                  onClick={attemptBuy}
                  className="px-4 py-2 rounded-xl font-semibold bg-slate-300 text-slate-900"
                >
                  Mua ô
                </button>
                <button
                  onClick={skipBuy}
                  className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
                >
                  Bỏ qua
                </button>
              </>
            )}
            <button
              onClick={reset}
              className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
            >
              Chơi mới
            </button>
            <button
              onClick={save}
              className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
            >
              Lưu
            </button>
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
            >
              Khôi phục
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm my-3">
            <div className="rounded-xl bg-slate-800/50 border border-slate-600/30 p-3">
              Tiền:{" "}
              <span
                className={`font-bold ${
                  state.money < 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                ${state.money}
              </span>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-600/30 p-3">
              Lượt đi: <b>{state.turn}</b>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-600/30 p-3">
              Vòng: <b>{state.laps}</b>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-600/30 p-3">
              Ô hiện tại:{" "}
              <b>
                {TILES[state.pos].name} (#{state.pos})
              </b>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-slate-600/40 p-3 text-sm">
            {state.action}
          </div>
          <div className="h-64 overflow-auto rounded-xl mt-3 p-3 bg-slate-950/60 border border-slate-600/20 text-sm text-slate-300">
            {state.log.length === 0 ? (
              <p>Log trống.</p>
            ) : (
              state.log.map((l, i) => (
                <p key={i} className="mb-1">
                  {l}
                </p>
              ))
            )}
          </div>
          <details className="mt-3 text-sm text-slate-300">
            <summary>Luật chơi (rút gọn)</summary>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Đi 1 xúc xắc (1–6). Qua ô <b>Xuất phát</b> nhận <b>+$200</b>.
              </li>
              <li>
                Ô <b>BĐS</b>: nếu chưa sở hữu có thể <b>mua</b>. Nếu bỏ qua sẽ
                trả <b>tiền thuê</b> cho ngân hàng.
              </li>
              <li>
                Ô <b>Cơ hội</b>: rút thẻ ngẫu nhiên có thể +/− tiền, di chuyển,
                hoặc vào Nhà tù.
              </li>
              <li>
                Ô <b>Thuế</b>: trả <b>$100</b>. Ô <b>Nhà tù</b>: bị giữ{" "}
                <b>1 lượt</b>.
              </li>
              <li>
                Phá sản khi tiền &lt; 0. Bạn đang chơi solo — mục tiêu là đi
                càng lâu càng tốt!
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
