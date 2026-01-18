import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

/**
 * In-memory rooms
 * {
 *   roomId: {
 *     clients: Set<WebSocket>,
 *     videoState: {
 *       playing: boolean,
 *       time: number,
 *       src: string,
 *       isYouTube: boolean
 *     }
 *   }
 * }
 */
const rooms = {};

wss.on("connection", ws => {
  ws.roomId = null;

  ws.on("message", raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, roomId, payload } = msg;

    switch (type) {

      // -------------------------------
      // CREATE ROOM
      // -------------------------------
      case "CREATE_ROOM": {
        if (!rooms[roomId]) {
          rooms[roomId] = {
            clients: new Set(),
            videoState: {
              playing: false,
              time: 0,
              src: "",
              isYouTube: false
            }
          };
        }

        rooms[roomId].clients.add(ws);
        ws.roomId = roomId;

        ws.send(JSON.stringify({
          type: "ROOM_CREATED",
          roomId
        }));
        break;
      }

      // -------------------------------
      // JOIN ROOM
      // -------------------------------
      case "JOIN_ROOM": {
        const room = rooms[roomId];
        if (!room) {
          ws.send(JSON.stringify({
            type: "ERROR",
            payload: { message: "Room not found" }
          }));
          return;
        }

        room.clients.add(ws);
        ws.roomId = roomId;

        // Send current video state to new user
        ws.send(JSON.stringify({
          type: "SYNC_STATE",
          payload: room.videoState
        }));
        break;
      }

      // -------------------------------
      // VIDEO EVENTS
      // -------------------------------
      case "PLAY":
      case "PAUSE":
      case "SEEK":
      case "SET_VIDEO": {
        const room = rooms[roomId];
        if (!room) return;

        // Update stored video state
        room.videoState = payload;

        // Broadcast to others in the room
        room.clients.forEach(client => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify({
              type,
              payload
            }));
          }
        });
        break;
      }

      // -------------------------------
      // CHAT
      // -------------------------------
      case "CHAT": {
        const room = rooms[roomId];
        if (!room) return;

        room.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: "CHAT",
              payload
            }));
          }
        });
        break;
      }
    }
  });

  // -------------------------------
  // CLEANUP ON DISCONNECT
  // -------------------------------
  ws.on("close", () => {
    const roomId = ws.roomId;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].clients.delete(ws);

    // Delete room if empty
    if (rooms[roomId].clients.size === 0) {
      delete rooms[roomId];
    }
  });
});

console.log(`WebSocket server running on port ${PORT}`);
