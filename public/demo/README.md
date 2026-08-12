# Demo song — "Neon Skyline" by "The Midnight Owls"

Everything in this folder was written and generated for this project. The
artist and the song do not exist: the lyrics are original, the audio is a
synthesised sine melody, the video is a canvas animation and the cover was
drawn programmatically. Nothing here is third-party material, so the demo can
ship with the app under its AGPL-3.0 licence.

It is served as-is over HTTP and fetched by the "Load demo song" button on the
landing page — not bundled into the JavaScript, so it costs nothing until
someone asks for it.

The files are a deliberately ordinary UltraStar song folder: a duet with two
singers, a golden note per track, `#GAP` at 1200 ms and `#VIDEOGAP` at 1.8 s so
the sync features have something real to work on.

Regenerating them requires the scripts used to author them; if you change the
`.txt` by hand, keep `#AUDIO`, `#VIDEO` and `#COVER` pointing at the filenames
in this folder and keep the filename list in `src/components/DropZone.tsx`
in sync.
