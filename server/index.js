// Pixel Fighter matchmaking server.
//
// Quick match: a player who picks ONLINE either joins someone already waiting, or becomes the
// host and waits. Once two players are paired the server just passes their messages along:
// small JSON lobby messages, the WebRTC handshake that lets the two games talk directly, and,
// if a direct link can't be made, the fight's input packets (a few bytes each).
//
// Runs anywhere Node runs; on Render it is set up by render.yaml at the repo root.
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
/** Biggest message we pass on; input packets are ~10 bytes, WebRTC offers a few KB. */
const MAX_MSG = 16 * 1024;

/** Players waiting for an opponent, by game version (only identical games can play together). */
const waiting = new Map();
let online = 0;

const http = createServer((req, res) => {
  // Render's health check and a quick way to see the server is up
  res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
  res.end(`pixel fighter server ok, ${online} online, ${waiting.size} waiting\n`);
});

const wss = new WebSocketServer({ server: http, maxPayload: MAX_MSG });

const send = (ws, m) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));

function leaveQueue(ws) {
  if (ws.version && waiting.get(ws.version) === ws) waiting.delete(ws.version);
}

wss.on('connection', (ws) => {
  online++;
  ws.alive = true;
  ws.partner = null;
  ws.on('pong', () => (ws.alive = true));

  ws.on('message', (data, isBinary) => {
    ws.alive = true;
    const p = ws.partner;
    // after pairing, everything is for the other player
    if (p) {
      if (p.readyState === p.OPEN) p.send(data, { binary: isBinary });
      return;
    }
    if (isBinary) return;
    let m;
    try {
      m = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (m.t !== 'quick' || typeof m.v !== 'string' || m.v.length > 64) return;
    ws.version = m.v;
    const host = waiting.get(m.v);
    if (host && host !== ws && host.readyState === host.OPEN) {
      // someone is hosting this version of the game: join them
      waiting.delete(m.v);
      host.partner = ws;
      ws.partner = host;
      send(host, { t: 'match', role: 'host' });
      send(ws, { t: 'match', role: 'guest' });
    } else {
      // nobody waiting: host a game and wait for the next player
      waiting.set(m.v, ws);
      send(ws, { t: 'waiting' });
    }
  });

  ws.on('close', () => {
    online--;
    leaveQueue(ws);
    const p = ws.partner;
    if (p) {
      p.partner = null;
      send(p, { t: 'left' });
      p.close();
    }
  });
});

// Drop connections that stopped answering (closed laptops, dead Wi-Fi) every 30 seconds.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 30000);

http.listen(PORT, () => console.log(`pixel fighter server listening on ${PORT}`));
