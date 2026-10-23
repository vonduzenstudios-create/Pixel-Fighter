# Pixel Fighter online server

A small Node server that pairs players for **Versus → Online** and passes their messages along.
Fights themselves mostly go directly between the two browsers; the server only carries them
when a direct link can't be made. It needs no database and fits Render's free plan.

## Put it on Render (one time, about 5 minutes)

1. Go to <https://dashboard.render.com/> and sign in (signing in with GitHub is easiest).
2. Click **New +** (top right), then **Blueprint**.
3. Under **Connect a repository**, pick **Pixel-Fighter**. If it isn't listed, click
   **Configure account** / **Connect GitHub** and give Render access to the repo, then come back.
4. Render reads `render.yaml` from the repo and shows one service, **pixel-fighter-server**
   (free plan). Click **Apply** (or **Deploy Blueprint**).
5. Wait for the deploy to show **Live** (a minute or two). Click the service name and copy its
   address at the top of the page, e.g. `https://pixel-fighter-server.onrender.com`.
   Opening that address in a browser should say `pixel fighter server ok`.
6. If the address is exactly `https://pixel-fighter-server.onrender.com`, you're done: the game
   already points there. If Render gave it a different name (it adds letters when a name is
   taken), put your address in `src/net/config.ts` with `wss://` in place of `https://`.

From then on, every push to `main` that touches `server/` redeploys it on its own.

**Free plan note:** Render puts a free server to sleep after 15 minutes with nobody connected.
The first player to pick Online after that waits up to about a minute while it wakes up (the
game says "Waking up the server"). Any paid plan stays awake.

## Run it on your own computer

```bash
cd server
npm install
npm start                 # listens on http://localhost:8080
```

Then open the game with `?server=ws://localhost:8080` on the end of its address, in two
browser windows, and pick Online in both.
