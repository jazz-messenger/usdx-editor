# CLAUDE.md — USDX Editor

Projektspezifischer Kontext für Claude Code. Bitte vor dem Arbeiten vollständig lesen.

---

## Stack & Architektur

- **React 19 + TypeScript + Vite** — kein Router, Single-Page-App
- **Styling:** reines CSS (App.css), kein Tailwind, keine CSS-in-JS
- **State:** lokaler React-State + `useReducer` in SongView; kein globaler Store
- **i18n:** eigenes System in `src/i18n/` — DE + EN, immer beide Sprachen gleichzeitig pflegen
- **Tests:** Vitest + Testing Library — **immer `npx vitest run` ausführen bevor Aussagen zur Testabdeckung gemacht werden**
- **Deployment:** manueller Trigger via GitHub Actions (`workflow_dispatch`) → FTP-Deploy

## Verzeichnisstruktur

```
src/
  components/      # React-Komponenten (je *.tsx + *.test.tsx)
  parser/          # USDX-Parser & Exporter (+ Tests)
  utils/           # Hilfsfunktionen (fileLoader, encoding, musicbrainz, …)
  i18n/            # translations.ts + LanguageContext
  App.tsx          # Root — steuert Landing vs. Editor-View über `song`-State
  App.css          # Globale Styles, Design Tokens als CSS-Variablen
public/
  icon-logo.png    # App-Icon (PNG, kein SVG-Bitmap)
```

## Wichtige Konventionen

- **Branch-Strategie:** `main` ist der Release-Kandidat. Feature-Branches für größere Arbeiten (`feature/xxx`). Jan merged selbst — kein PR-Review nötig.
- **Commit-Sprache:** Englisch, Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`)
- **Keine nativen `title`-Attribute** — stattdessen `<Tooltip>` aus `src/components/Tooltip.tsx`
- **Hover-Stile:** subtiler oranger Tint (`rgb(var(--accent-primary) / .08–.12)`), kein voller Farbwechsel
- **Dezimalstellen:** GAP, VIDEOGAP, Zeitanzeigen immer ganzzahlig (`Math.round`)
- **Beide Sprachen:** Jede Änderung in `translations.ts` betrifft immer `de` UND `en`

## SingStar-Dictionary (`singstarSongDictionary.ts`)

Beim Hinzufügen neuer Songs **immer** dieses Protokoll einhalten — Abweichungen haben mehrfach den Build gebrochen:

1. **Vor dem Einfügen auf Duplikate prüfen** — Key `"Artist - Title"` darf nur einmal vorkommen. Existiert er bereits, Editions **mergen**, nicht doppelt eintragen.
2. **Neue CountryCodes in den Typ aufnehmen** — `CountryCode` in Zeile 13 muss alle verwendeten Ländercodes kennen. Nach dem Einfügen prüfen: alle Codes im Dictionary ∈ `CountryCode`.
3. **Strukturvalidierung vor dem Commit** — `tsc --noEmit` muss fehlerfrei durchlaufen. Zusätzlich sicherstellen, dass kein Editions-Objekt versehentlich in einem `countries`-Array landet (Patch-Skripte haben das mehrfach produziert).
4. **Patch-Skripte ankern an `} as const;`** — nicht an `};` (das schließt die Typ-Definition, nicht das Dictionary).

## Bekannte Stolpersteine

- **Tooltip-Clipping:** `position: fixed` + `getBoundingClientRect()` verwenden — `position: absolute` wird von `overflow: hidden`-Eltern abgeschnitten
- **Tooltip-Hintergrund:** explizite Farbe `rgb(32 32 54)` statt CSS-Variable (war semi-transparent)
- **Tab-Switcher-Layout:** `.tooltip-wrap` innerhalb Flex-Container braucht `flex: 1; display: flex`, sonst bricht das Layout
- **Waveform-Playhead:** `absolutePlayheadS = currentMs / 1000 + videoGap` — `currentMs` ist beat-relativ, nicht absolut
- **git filter-repo** entfernt den `origin`-Remote — nach Ausführung manuell neu setzen

## Design System (CSS-Variablen)

```css
--accent-primary      /* Orange — Hauptakzent */
--accent-primary-2    /* Helles Lila — Singer 1 */
--accent-singer-2     /* Pink/Rot — Singer 2 */
--bg-base / --bg-card / --bg-elevated
--text-primary / --text-muted / --text-dim
--border-subtle
--radius-lg / --radius-md
```

## Lizenz

AGPL-3.0-only — Änderungen müssen auch bei Netzwerk-/SaaS-Nutzung als Open Source veröffentlicht werden.

---

## Backlog (GitHub Issues)

| # | Titel | Status |
|---|-------|--------|
| #2 | Audio- und Video-Datei gleichzeitig abspielen | Open — bewusst zurückgestellt |
| #1 | Golden Notes editierbar machen | Open |
| #3 | Auto-Detect VIDEOGAP via Audio-Kreuzkorrelation | Open |
| #6 | Auto-Detect GAP via Onset-Erkennung im VOCALS-Stem | Open |
| #7 | Epic: Stem-Support (VOCALS / INSTRUMENTAL) | Open — Epic |
| #8 | Medley-Parameter befüllen | Open |
| #9 | PREVIEWSTART setzen | Open |
| — | Browser-Extension für USDB-Song-Abruf | Backlog, kein Issue |

## Feature-Ideen (noch kein Issue)

- Singer-Namen Uppercase-Anzeige prüfen (wahrscheinlich kein Bug — Sichtung ergab keinen `text-transform: uppercase` auf den Inputs)
- Startseite: Audio-Waveform-View als neues Highlight-Feature aufnehmen
