// Where the online matchmaking server lives (see server/README.md for putting it on Render).
// After deploying, set this to your Render service's address with wss:// in front.
// For testing you can also add ?server=ws://localhost:8080 to the game's URL.
const DEFAULT_SERVER = 'wss://pixel-fighter-server.onrender.com';

export const SERVER_URL = (() => {
  try {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
  } catch {
    /* no location outside a browser */
  }
  return import.meta.env.VITE_SERVER_URL || DEFAULT_SERVER;
})();
