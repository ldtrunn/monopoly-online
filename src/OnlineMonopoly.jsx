import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const SIZE = 6;
const SOCKET_URL = "https://monopoly-online-hh01.onrender.com";

function indexToCoord(i) {
  const s = SIZE;
  if (i < s) return { row: 1, col: i + 1 };
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

export default function OnlineMonopoly() {
  const [sock, setSock] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("Player");
  const [state, setState] = useState(null); // snapshot từ server
  const [createdRoom, setCreatedRoom] = useState("");

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket"] });
    setSock(s);
    s.on("state", (snap) => setState(snap));
    s.on("roomCreated", ({ roomId }) => setCreatedRoom(roomId));
    s.on("error", ({ message }) => alert(message));
    return () => s.disconnect();
  }, []);

  const boardCells = useMemo(() => {
    if (!state) return [];
    const cells = new Array(SIZE * SIZE).fill(null);
    state.tiles.forEach((t, idx) => {
      const { row, col } = indexToCoord(idx);
      const index = (row - 1) * SIZE + (col - 1);
      cells[index] = { ...t, idx };
    });
    return cells;
  }, [state]);

  const meId = sock?.id;
  const myTurn = state && state.players[state.turn]?.id === meId;

  if (!state) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#0b1220] to-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div
          className="rounded-2xl bg-slate-900/90 border border-slate-600/20 p-4 shadow-xl"
          style={{ maxWidth: 560, width: "100%" }}
        >
          <h2 className="font-bold mb-2">Cờ Tỷ Phú Online</h2>
          <div className="mb-2">
            <label>Tên của bạn</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-600/40 bg-slate-900/80 text-slate-100"
            />
          </div>
          <div className="flex gap-2 my-2">
            <button
              onClick={() => sock.emit("createRoom", { name })}
              className="px-4 py-2 rounded-xl font-semibold bg-cyan-400 text-slate-900"
            >
              Tạo phòng
            </button>
            <input
              placeholder="Nhập mã phòng (VD: ABCD)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className="flex-1 p-2 rounded-xl border border-slate-600/40 bg-slate-900/80 text-slate-100"
            />
            <button
              onClick={() => sock.emit("joinRoom", { roomId, name })}
              className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
            >
              Tham gia
            </button>
          </div>
          {createdRoom && (
            <p className="text-slate-300">
              Đã tạo phòng: <b>{createdRoom}</b> — gửi mã này cho bạn bè để họ
              tham gia.
            </p>
          )}
          <p className="text-slate-400 text-sm mt-2">
            Sau khi đủ người, bấm <b>Bắt đầu</b> trong màn chính.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0b1220] to-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="grid gap-5 w-full max-w-[1200px] md:grid-cols-[1.1fr_0.9fr]">
        {/* Board */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-600/20 p-4 shadow-xl">
          <div className="flex items-center gap-2 font-bold mb-3">
            <span>🎲</span>
            <span>Cờ Tỷ Phú Online · Phòng {createdRoom || "—"}</span>
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
            {boardCells.map((t, i) => {
              if (!t)
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-transparent"
                  />
                );
              // vẽ token người chơi
              const tokens = state.players.filter((p) => p.pos === t.idx);
              const ownerId = state.owner[t.idx];
              const owned = !!ownerId;
              return (
                <div
                  key={i}
                  className={`relative rounded-xl border ${"bg-slate-900/80 border-slate-600/30"} overflow-hidden`}
                  style={{
                    outline:
                      t.type === "property"
                        ? owned
                          ? "2px solid rgba(34,211,238,.8)"
                          : "1px solid rgba(148,163,184,.25)"
                        : "1px dashed rgba(148,163,184,.35)",
                  }}
                >
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
                    <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                      {tokens.map((pl) => (
                        <div
                          key={pl.id}
                          title={pl.name}
                          className="w-4 h-4 rounded-full"
                          style={{
                            background: pl.id === meId ? "#22d3ee" : "#a78bfa",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Người chơi:{" "}
            {state.players
              .map((p) => `${p.name}${p.bankrupt ? "(💥)" : ""}`)
              .join(", ")}
          </p>
        </div>

        {/* Panel */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-600/20 p-4 shadow-xl">
          <div className="font-bold mb-2">Bảng điều khiển</div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-300 mb-2">
            <span className="px-2 py-1 rounded-full bg-slate-600/20">
              Lượt hiện tại:{" "}
              <b className="ml-1">{state.players[state.turn]?.name}</b>
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-600/20">
              Xúc xắc: <b className="ml-1">{state.lastRoll ?? "—"}</b>
            </span>
          </div>
          <div className="flex flex-wrap gap-2 my-2">
            {!state.started && (
              <button
                onClick={() => sock.emit("start")}
                className="px-4 py-2 rounded-xl font-semibold bg-cyan-400 text-slate-900"
              >
                Bắt đầu
              </button>
            )}
            {myTurn && state.started && (
              <button
                onClick={() => sock.emit("roll")}
                className="px-4 py-2 rounded-xl font-semibold bg-cyan-400 text-slate-900"
              >
                Quay xúc xắc
              </button>
            )}
            {myTurn && state.pendingBuy && (
              <button
                onClick={() => sock.emit("buy")}
                className="px-4 py-2 rounded-xl font-semibold bg-slate-300 text-slate-900"
              >
                Mua ô
              </button>
            )}
            {myTurn && state.pendingBuy && (
              <button
                onClick={() => sock.emit("skipBuy")}
                className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
              >
                Bỏ mua
              </button>
            )}
            {myTurn && state.started && (
              <button
                onClick={() => sock.emit("endTurn")}
                className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
              >
                Kết thúc lượt
              </button>
            )}
            <button
              onClick={() => sock.emit("reset")}
              className="px-4 py-2 rounded-xl font-semibold border border-slate-600/40 text-slate-100"
            >
              Chơi mới
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm my-3">
            {state.players.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-slate-800/50 border border-slate-600/30 p-3"
              >
                {p.name}:{" "}
                <b style={{ color: p.money < 0 ? "#fb7185" : "#34d399" }}>
                  ${p.money}
                </b>{" "}
                · Ô:{" "}
                <b>
                  {state.tiles[p.pos].name} (#{p.pos})
                </b>{" "}
                {p.skip > 0 ? `· Bỏ lượt còn: ${p.skip}` : ""}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-dashed border-slate-600/40 p-3 text-sm">
            Nhật ký
          </div>
          <div className="h-64 overflow-auto rounded-xl mt-2 p-3 bg-slate-950/60 border border-slate-600/20 text-sm text-slate-300">
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
        </div>
      </div>
    </div>
  );
}
