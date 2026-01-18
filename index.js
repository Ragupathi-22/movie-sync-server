import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 3000 });

// In-memory room store
const rooms = {}; 
// rooms = {
//   roomId: {
//     clients: Set<WebSocket>,
//     video: { playing: false, time: 0, src: "" }
//   }
// }

wss.on("connection", ws => {
  ws.roomId = null;

  ws.on("message", raw => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const { type, roomId, payload } = data;

    // CREATE ROOM
    if (type === "CREATE_ROOM") {
      rooms[roomId] = {
        clients: new Set(),
        video: { playing: false, time: 0, src: "" }
      };
      ws.roomId = roomId;
      rooms[roomId].clients.add(ws);
      ws.send(JSON.stringify({ type: "ROOM_CREATED", roomId }));
      return;
    }

    // JOIN ROOM
    if (type === "JOIN_ROOM") {
      if (!rooms[roomId]) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Room not found" }));
        return;
      }
      ws.roomId = roomId;
      rooms[roomId].clients.add(ws);

      // Send current video state to new user
      ws.send(JSON.stringify({
        type: "SYNC_STATE",
        payload: rooms[roomId].video
      }));
      return;
    }

    // Require valid room
    if (!ws.roomId || !rooms[ws.roomId]) return;

    // Update video state
    if (["PLAY", "PAUSE", "SEEK", "SET_VIDEO"].includes(type)) {
      rooms[ws.roomId].video = payload;
    }

    // Broadcast to room only
    rooms[ws.roomId].clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(JSON.stringify({ type, payload }));
      }
    });
  });

  ws.on("close", () => {
    const roomId = ws.roomId;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].clients.delete(ws);

    if (rooms[roomId].clients.size === 0) {
      delete rooms[roomId];
    }
  });
});

console.log("WebSocket server running");
