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

The companion reads the visible game clock locally with Tesseract OCR. It
checks overlapping regions around the upper-right timer and reports when
neither yields a readable time. It does not analyze the minimap or issue lane
alerts before 01:20. At that threshold it resets lane tracking, starts
automatic minimap detection, and asks the user to press TAB; if capture starts
after 01:20, it does so as soon as the current clock is recognized. Detection
then reports lane markers disappearing for more than five seconds. This avoids
treating the initial absence of lane opponents as a missing-player alert.
Clock and minimap heuristics are experimental and may fail depending on
resolution, HUD scale, and image quality. The companion warns when Void Grubs
are due to spawn at 08:00, starting at 07:00; if detection starts later, the
warning reports the remaining time when the grubs have not spawned yet.

After 01:20, while the TAB scoreboard is open, the companion checks the second
red-team rows for champion portraits. It searches a small area around each
expected row position and compares the captured image against a bundled local
catalog of Riot Data Dragon champion icons (version 16.21.1). Because row
positions vary with resolution and HUD scale, use "Ajustar recortes do TAB"
while the scoreboard is visible: drag each numbered circle over only the
champion portrait and adjust its size. The guide and matching crop are circular;
pointer positioning accounts for letterboxing in the calibration preview.
Crop positions persist locally in a profile keyed to the captured frame
resolution, so windowed and bordered-fullscreen captures can keep separate
calibrations. Select "Minimapa" to move and resize the minimap search area in
the same preview; its calibration is cached separately per captured
resolution.
During calibration, each row reports the best icon match, error, and margin;
these measurements help distinguish a misaligned crop from an unsuitable
matching threshold. Three consecutive confident matches produce a visual
suggestion, but never assign a champion automatically: confirm the suggestion
or select the champion manually. This prevents an uncertain visual match from
silently changing the jungler tracker. Uncertain crops remain unidentified,
and the same champion cannot be confirmed in multiple roster rows. The official
square icon and champion name are shown; a confirmed suggestion uses the
circular in-game crop as the local visual template for red-ringed minimap icons.
The minimap search scales expected icon size to its calibrated dimensions.
Confirm the jungler suggestion (or select the champion) and assign the second
TAB row to JUNGLE; only then can that portrait drive minimap tracking and
location alerts.
TAB visibility is checked independently on every captured frame, even before
lane detection is enabled. After two consecutive frames confirm the scoreboard,
the companion immediately displays five placeholder cards and announces
"Inimigos detectados com sucesso."; champion matching then runs asynchronously
and fills in each card as portraits are identified.
When a confirmed portrait is captured for the jungle assignment, the companion
announces "Captura do jungler feita com sucesso." The roster shows only each
champion and its lane assignment; changing the lane selector swaps assignments,
so the user can correct the default TOP/JUNGLE/MID/ADC/SUPPORT order. Lane
disappearance alerts require an identified champion and are deferred while that
champion's portrait is still recognized on the minimap.
Only a strong, unambiguous match that remains in the same place across
consecutive scans is reported as top, top river near Void Grubs, mid, bot river
near dragon, or bot. This experimental image match uses the current scoreboard
portrait rather than downloading a full champion library; it may not match
every HUD scale or minimap rendering, and it may withhold alerts when a match
is uncertain. The bundled champion art is from Riot Games Data Dragon and can
be refreshed from its published champion catalog when game patches change.
Zone classification checks the mid diagonal before outer-lane areas and uses
the map diagonal to distinguish the two river sides, avoiding the earlier
left/right comparison that could label bot-side positions as top.

Do not read game memory, inject into the client, automate gameplay, or infer a
hidden enemy position. Check Riot Games' current policies and registration
requirements before distributing the app or adding other data sources.

## References

- [Riot Games Developer Policies](https://developer.riotgames.com/policies/general)
- [League of Legends Developer Documentation](https://developer.riotgames.com/docs/lol)
- [Riot Data Dragon champion catalog](https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/champion.json)
- [PanSen Panel](https://github.com/jimmybytes/pansen-panel) is an independent
  Electron/JavaScript example, not an endorsement or evidence of Riot approval.
