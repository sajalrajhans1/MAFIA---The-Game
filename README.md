# MAFIA · A game of cards & lies

A first-person Mafia card game that runs in the browser. You sit at a smoky 1940s card table,
you're dealt one card in secret, and that card is your role. Play **solo against eleven scheming
regulars**, or **open a room for your friends**.

| Card | Role | Power |
|---|---|---|
| **Joker** | Mafia | Each night the Jokers agree on a victim. They win when they equal or outnumber everyone else. |
| **King** | Sheriff | Each night, investigates one player and learns if they're Mafia. |
| **Ace** | Angel | Each night, protects one player from the Mafia (not the same person two nights running). |
| **2–10** | Civilian | No powers. Talk, deduce, vote. |

## Two ways to play

### Single player: the back room

You against the regulars. It's the same eleven faces every time, each with a temper, verbal tics and
tells of their own: Vinnie the Enforcer, Rosa the Bookkeeper, Sal the Nose, Dolores the Songbird,
Lucky Lou, Frankie Nine-Fingers, Mae the Landlady, Tommy the Rookie, Bugsy the Hothead,
Carmela the Widow and Doc the Professor.

- Pick how many sit down (3 to 11) and how sharp they are: **Rookie**, **Wiseguy** or **Mastermind**.
- They only know what their seat could know: their own card, their partners if they're Jokers, their
  own Sheriff checks, and everything said and voted in the open. They remember who pushed an innocent
  onto the gallows, who defended a Joker, and who claimed what.
- **Talk to them.** Name someone to accuse them, ask *"who do you suspect?"*, ask
  *"Rosa, what about Sal?"*, claim your card (*"I'm the King, Sal is a Joker"*) or plead your innocence.
  They answer, argue, bluff, fake-claim, bandwagon and throw a partner under the bus.
- Draw a Joker and your partners whisper with you at night. Name a victim and they'll follow.

### With friends: rooms

1. Click **PLAY WITH FRIENDS → OPEN A ROOM**. You're the host.
2. Share the 5-letter code, or click **COPY INVITE LINK** and send it.
3. Friends open the link (or type the code) and take a seat. 4 to 12 players.
4. The host sets the house rules and clicks **DEAL THE CARDS**.

Rooms are people only. Game traffic goes peer to peer (WebRTC via the free PeerJS signalling
server), so there's no game server to run.

## The wardrobe

Dress your character in a live 3D wardrobe (drag to turn it, wheel to zoom from face to seated):
suit colour, cloth (plain, pinstripe, chalk stripe, check), tie or bow tie, lapel flower, pocket square
or pin, fedora, bowler, flat cap, trilby or top hat in five tones, seven haircuts in six colours,
six skin tones, six eye shapes and six eye colours, beards and moustaches, eight mouths (a cigar
among them) and eyewear from round specs to an eyepatch. Every option is independent.

Characters blink, glance around, look at whoever is talking, and part their lips when they speak.
At night, fellow Jokers see each other's eyes glow red.

## A round

1. **The deal.** Click your card to flip it. Keep it secret.
2. **Night.** Civilians sleep. The Jokers pick a victim together in a secret chat; the King
   investigates; the Ace protects. If the Jokers can't agree in time, fate picks a victim.
3. **Dawn.** Find out who died and see their card.
4. **Day.** Discuss. Speech bubbles pop over the speaker's head; use emotes (nod, shrug, point...).
   When a majority is ready, voting starts early.
5. **Vote.** Click the player you accuse. Most votes gets last words, then is executed.
   Ties and skips spare everyone.

The dead become ghosts: they see every card and chat with each other in the graveyard.

## Controls

- **Drag** to look around · **A / D** turn · **Space** re-center · **Wheel** zoom
- **Click** a player (or their name tag, or their row in the list) to choose them
- **Right-click** a player to privately mark them **?** suspect or **✓** trusted
- **Enter** chat · **H** hide the HUD · click your card on the table to peek at it

## Run it locally

It's a static site with no build step and no backend.

- `python serve.py`, then open <http://localhost:8080>
  (it also prints an address for friends on the same Wi-Fi), or
- `npm start`, or on Windows double-click `start.bat`.

Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

## Deploy

Upload the folder to any static host: GitHub Pages, Netlify, Vercel, Cloudflare Pages, or itch.io
as an HTML game. On GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / root*.

For link previews on social media, change the two `og:image` / `twitter:image` tags in `index.html`
to the full URL of `assets/img/title.jpg` on your domain.

## Graphics & performance

**OPTIONS → Graphics** defaults to **AUTO**: it guesses a tier from your GPU, then watches frame times
and steps between LOW, MEDIUM and HIGH on its own (ULTRA is manual). LOW drops shadows, bloom, MSAA
and decorative lights and renders at a lower resolution, so it runs on old laptops and integrated GPUs.
Each character is a handful of skinned meshes, which keeps the CPU cost low.

## How it's built

- **Three.js** (CDN import map): a procedural room with normal-mapped wood, wallpaper, felt and leather;
  physically based materials; a reflection environment built from the room's own lights; sculpted,
  skinned characters with two-bone arm IK, eye and eyelid rigs and baked skin shading; PCF shadows,
  MSAA, bloom and a film pass (grade, grain, vignette, night grading); lamp beams, candle flames,
  dust, smoke, rain and lightning.
- Textures (felt, wood, wallpaper, cloth, irises, number cards, card back) are drawn on canvas at runtime.
  The four images in `assets/img` (title art, King, Joker, Ace) were generated with Higgsfield.
- Audio is synthesized with WebAudio: walking-bass noir jazz, a night drone, heartbeat tension,
  rain, thunder, gunshots, cards and retro UI blips.
- The host's browser runs the authoritative game and sends each player a personalised view,
  so hidden roles never reach anyone else's browser. In single player the same host also runs the
  regulars: a suspicion model built only from what each seat can know, a small language parser for
  your chat, and a dictionary of well over a thousand lines of table talk.

```
index.html          page shell and UI markup
css/style.css       retro UI
js/main.js          app controller: modes, rooms, messages, wiring
js/server.js        game rules and host logic
js/bots.js          the regulars: knowledge, suspicion, planning, chat
js/botlines.js      the cast and their lines   (+ botlines-more.js)
js/looks.js         wardrobe options
js/characters.js    sculpted, skinned characters and their animation
js/preview.js       the wardrobe stage
js/scene.js         3D room, lighting, camera, picking, effects
js/net.js           PeerJS transport
js/cards.js         roles, deck, card art
js/textures.js      procedural textures
js/ui.js            HUD, chat, name tags, overlays, wardrobe, modals
js/audio.js         synthesized music and sound
```

## Development

`npm test` runs the rules suite, 120 full single-player games against the regulars, and a fuzzer that
plays 300 random games with hostile traffic, checking for crashes, role leaks and games that never end.

### Known limits

- If the host closes their tab, the room ends.
- Players behind very strict NATs may fail to connect peer to peer; a TURN server would fix that.
