# Asset generators

The landing page ships two sets of generated assets that are checked in but not
hand-made. These scripts are how they were produced, so they can be changed
instead of being frozen forever:

- `public/demo/` — the demo song behind the "Load demo song" button
- `src/assets/tour/` — the eight screenshots behind the landing-page tour

Nothing here runs during `npm run dev`, the build, or CI. They are one-off tools
you reach for when the demo song or the tour needs to change.

## Requirements

- **Google Chrome** — driven headlessly over the DevTools Protocol. Override the
  binary with `CHROME_PATH` if it is not in the standard macOS location.
- **Node 22+** — `cdp.mjs` uses the global `WebSocket`, so no dependency is
  needed for the protocol client.
- **Pillow** — for the cover art and the WebP encoding. On macOS the system
  interpreter usually has it: `/usr/bin/python3`.

## Demo song

```bash
/usr/bin/python3 scripts/generate-demo-song.py    # .txt, .wav and the cover
node scripts/generate-demo-video.mjs              # the .webm
```

Both write straight into `public/demo/`; pass an output path to write elsewhere.

The song text, audio and cover are **deterministic** — regenerating them
reproduces the committed files byte for byte, so an unexpected diff means
something actually changed.

The video is **not**. `MediaRecorder` captures the canvas in real time, so the
clip comes out as long as the wall clock allowed and the VP9 encoder is fed a
different number of frames on every run. Expect a different file size and
duration each time. The script checks that the result is long enough to cover
the song and exits non-zero if it is not — re-run it on an idle machine if that
fires. Because of this, only regenerate the video when you actually intend to
change it.

If you change `#VIDEOGAP` or the note timings in `generate-demo-song.py`, the
constants at the top of `generate-demo-video.mjs` have to follow.

## Tour screenshots

Needs the app running (`npm run dev` in another shell):

```bash
node scripts/capture-tour.mjs                      # German
LOCALE=en node scripts/capture-tour.mjs            # English
/usr/bin/python3 scripts/process-tour-shots.py     # PNG -> WebP into src/assets/tour
```

The capture drives the real application: it loads the demo song through the
actual file input, hovers the assign arrow to raise a real tooltip, and plays
the video to catch the live highlighting mid-phrase. That is why the shots stay
truthful — but also why they go stale the moment the editor's layout changes.

`capture-tour.mjs` throws if a step it depends on cannot be reached, rather than
quietly producing a screenshot of the wrong state. If a selector in it stops
matching after a refactor, that is the failure it is there to catch.

Both locales are captured because `LandingTour.tsx` imports one set per
language, so the UI in the picture speaks the reader's language. Adding a locale
means capturing a third set and extending the `SHOTS` map in that component.

The crop height in `process-tour-shots.py` is tuned to the current editor
layout: it cuts the empty panel below the lyrics while keeping the media
controls. Check the output if the layout changes height.
