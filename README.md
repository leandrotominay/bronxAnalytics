# League Event Companion

Windows desktop proof of concept built with Electron and TypeScript.

## Run locally

```powershell
npm install
npm run dev
```

`npm run build` creates a production build, and `npm run typecheck` checks the
main, preload, and renderer TypeScript code.

## Current scope

The app searches desktop window titles for `League of Legends (TM) Client` on
startup and retries while none is available. If exactly one matching window
is found, it selects it automatically; if several match, it selects the first
and reports that choice. Capture begins only after the user presses Start.
The compact interface has Start/Stop controls and an
alert list; window discovery and minimap estimation happen in the background.
The minimap region is estimated from its standard bottom-right placement. The
renderer automatically looks for red pixel components inside that region and
assigns them to top, mid, or bot using their position: a diagonal band is mid,
while candidates outside it are assigned top or bot by whether they are in the
upper or lower half of the minimap. After a lane has been observed, a stable
drop in its marker count starts a timer; if it remains absent for more than
five seconds, the companion announces that the lane's enemy laner disappeared
and shows the elapsed time in the alert list. Image processing is limited to
the estimated minimap region and sampled at four frames per second.
This color/geometry heuristic does not identify champions or understand game
state; red UI elements, effects, scaling, and map orientation can cause false
matches or missed detections. It only reports visible markers and does not
predict positions after they disappear. Alerts appear in the companion window
and, during active capture, in the separate overlay. The app does not modify
the game. Frames stay in the local renderer and are not uploaded. Do not rely
on this prototype for accurate in-game alerts.

During active capture, a separate transparent, click-through overlay displays
each new alert near the top-left of the primary display for seven seconds. It
does not take focus or intercept mouse/keyboard input, and it is hidden when
capture stops. Use borderless-window mode; exclusive fullscreen may draw above
the overlay. The overlay is attached to the primary display and can remain
visible over other apps while capture is active.

The companion also tries to read the visible game clock locally with Tesseract
OCR. It requires two consistent readings before starting match-time alerts,
asks the user to show the scoreboard at 00:10, and warns about Void Grubs at
05:00 (their expected spawn time is 06:00). Scoreboard OCR currently only
attempts to detect that the panel is open; it does not identify champions,
teams, lanes, or the enemy jungler. These timing and scoreboard features are
experimental and may fail depending on resolution, HUD scale, and image quality.

Do not read game memory, inject into the client, automate gameplay, or infer a
hidden enemy position. Check Riot Games' current policies and registration
requirements before distributing the app or adding other data sources.

## References

- [Riot Games Developer Policies](https://developer.riotgames.com/policies/general)
- [League of Legends Developer Documentation](https://developer.riotgames.com/docs/lol)
- [PanSen Panel](https://github.com/jimmybytes/pansen-panel) is an independent
  Electron/JavaScript example, not an endorsement or evidence of Riot approval.
