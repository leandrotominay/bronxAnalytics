# Bronx Analytics

Windows desktop companion built with Electron and TypeScript. The interface
uses a dark charcoal surface with crimson accents; developer diagnostics are
hidden until **Modo desenvolvedor** is enabled.

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
The dashboard presents capture controls, recent alerts, the opponent roster,
and the detected jungler. Technical diagnostics and manual calibration tools
are hidden until **Modo desenvolvedor** is enabled; this switch does not pause
alert audio. Within developer mode, audio can be paused separately.
Alert speech can be customized independently: choose an installed system voice,
adjust its rate and pitch, and preview it. Preferences are stored locally on
the device; the available voices depend on Windows speech settings. Speech is
provided locally by Windows and alert text is not sent to a voice service.
Next session priorities are tracked in:
[`TODO-PROXIMA-SESSAO.md`](./TODO-PROXIMA-SESSAO.md).
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

## Local match diagnostics

Turn on **Diagnóstico** before capture or during a match to pause speech while
keeping visual overlay alerts active. The panel shows the actual captured
frame dimensions, Live Client API roster status,
current capture profile, minimap crop bounds, lane marker counts and watch
timers, and the last minimap match status and scores. The minimap preview marks
the latest candidate even when it is rejected as ambiguous or low-confidence.
The **Salvar amostra diagnóstica** button is available during capture without
enabling diagnostic mode; this lets you collect a sample while alerts remain
active.

Before saving a sample, enter the expected jungler champion and the zone you
observe in the visible game (or choose "Não visível"). Click **Salvar amostra
diagnóstica** and choose a local folder. The app writes a timestamped directory
with `manifest.json`, the full captured frame, the calibrated minimap crop,
and the current roster from the local match API. Saving is an explicit user
action; no frames are uploaded or saved automatically. Use samples from one
match to calibrate, then collect separate matches to measure false alerts,
misses, and location accuracy.

During active capture, a separate transparent, click-through overlay displays
each new alert near the top-left of the primary display for seven seconds. It
does not take focus or intercept mouse/keyboard input, and it is hidden when
capture stops. Use borderless-window mode; exclusive fullscreen may draw above
the overlay. The overlay is attached to the primary display and can remain
visible over other apps while capture is active.

The companion reads the visible game clock locally with Tesseract OCR. It
checks compact, overlapping crops around the upper-right timer and reports
the raw OCR text and confidence in diagnostic mode and saved samples. The
clock parser can extract a time even when OCR also picks up nearby HUD digits.
Lane-marker detection and missing-laner alerts wait until 01:20, when the
clock activates lane tracking; this avoids treating the initial absence of
lane opponents as a missing-player alert. Jungler minimap scans start as soon
as the API identifies a jungler and do not depend on OCR recognizing the
clock. Lane-marker detection uses the same calibrated minimap crop and alerts
when the red-marker count in a lane drops after that lane has been seen. It is
an aggregate lane signal, not yet reliable identification of a specific
champion disappearing. No TAB action is required.
Clock and minimap heuristics are experimental and may fail depending on
resolution, HUD scale, and image quality. The companion warns when Void Grubs
are due to spawn at 08:00, starting at 07:00; if detection starts later, the
warning reports the remaining time when the grubs have not spawned yet.

Diagnostic mode pauses speech while keeping visual overlay alerts active. It
starts disabled each time the app opens, and adjusting the minimap does not
enable it.

The opponent roster comes from the documented local Game Client API endpoint
`https://127.0.0.1:2999/liveclientdata/allgamedata`. The app filters out the
active player's team and uses each opponent's champion and `position` fields.
It polls only while capture is active, sends no player data off-device, and
does not require a Riot API key. Riot's root certificate is used to validate
the local HTTPS connection; certificate verification is not disabled. If the
API omits or duplicates a position, the roster marks it as unknown and does not
track that player as jungler until the user corrects the lane. A temporary API
failure is shown in the roster status.

The API identifies players and lanes but does not return their map coordinates.
For minimap tracking, the app uses the local Data Dragon champion icon (version
16.21.1) as the visual template and analyzes only the visible minimap. This
match is experimental and may fail with minimap scaling, overlapping icons, or
low image detail; it does not infer a hidden enemy position. The roster's lane
selector remains available for manual corrections, which are kept while the
match API continues updating.

The minimap search scales expected icon size to the calibrated minimap bounds.
Use **Ajustar minimapa** to move and resize that area; its calibration is cached
separately for each captured frame resolution. After two stable, confident
matches, the app announces transitions between approximate map regions:
upper/middle/lower river, top/mid/bottom lane, Baron and Dragon pits, and the
Blue, Red, Gromp, Wolves, Raptors, and Krugs camps on either map side. Camp and
base alerts are labeled allied or enemy based on the player's team from the
local match API. Region boundaries are geometric estimates from normalized
minimap coordinates, not game-provided coordinates; validate them in a live
match and treat ambiguous or low-confidence portrait matches as inconclusive.
The tracker only reports a jungler portrait currently visible on the minimap;
it does not estimate a hidden position. Lane disappearance alerts require an
identified champion and are deferred while that champion's portrait is still
recognized on the minimap.

The Game Client API is available only to native applications and uses a local
self-signed HTTPS certificate. Riot requires products to be registered and
their Game Client API use to be documented; read the current policies before
distribution. Do not disable certificate verification or use the API to reveal
information that is not available through normal gameplay.
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
