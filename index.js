import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 3000 });

wss.on("connection", ws => {
  ws.on("message", message => {
    // broadcast to everyone
    wss.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(message.toString());
      }
    });
  });
});

console.log("WebSocket server running");
