# USDX Editor

**Der Browser-Editor für deine UltraStar-Songs.**

Ein kostenloser, datenschutzfreundlicher Editor für [UltraStar Deluxe](https://usdx.eu/) Songdateien — direkt im Browser, ohne Installation.

🔗 **[korczak.at/usdx-editor](https://korczak.at/usdx-editor/)**

---

## Features

- 🎤 **Metadaten pflegen** — Titel, Künstler, Genre, Jahr, Sprache, Edition und mehr
- ⏱️ **GAP & VIDEOGAP einstellen** — mit Live-Vorschau und YouTube-Integration
- 🎵 **Live-Highlighting** — Phrasen werden beim Abspielen hervorgehoben
- 👥 **Duett-Support** — zwei Stimmen, getrennte Zuweisung, zusammengeführte Ansicht
- ⭐ **Golden Notes** — visuelles Glow-Highlighting
- 🎶 **SingStar-Editions-Vorschläge** — automatische Erkennung aus einer kuratierten Songdatenbank
- 📅 **Jahreserkennung** — automatischer Abruf via MusicBrainz
- 🔍 **YouTube-Suche** — komfortabler Videolink direkt im Editor
- 🖼️ **Cover-Art** — automatischer Abruf und lokale Vorschau

---

## Datenschutz

**Deine Dateien verlassen nie deinen Rechner.**

Der Editor verarbeitet alle Songdateien ausschließlich lokal im Browser. Es findet keine Übertragung von Songdaten, Texten oder Metadaten an externe Server statt.

Externe Verbindungen werden nur hergestellt wenn der Nutzer dies aktiv auslöst:
- **YouTube** — beim Einbinden eines Videos (Google Privacy Policy)
- **MusicBrainz** — beim automatischen Jahres-/Genre-Abruf (nur Künstler + Titel)

---

## Urheberrecht & Haftungsausschluss

Der USDX Editor ist ein reines Bearbeitungswerkzeug. **Der Nutzer ist selbst verantwortlich** für die urheberrechtliche Situation der von ihm bearbeiteten Songdateien, Texte, Cover-Bilder und Audiodateien.

Der Betreiber speichert, hostet oder verteilt keine urheberrechtlich geschützten Inhalte.

---

## Datenquellen

Song- und Editionsdaten für SingStar-Vorschläge basieren auf Inhalten der Wikipedia:
- [List of songs in SingStar games (PlayStation 2)](https://en.wikipedia.org/wiki/List_of_songs_in_SingStar_games_(PlayStation_2))
- [List of songs in SingStar games (PlayStation 3)](https://en.wikipedia.org/wiki/List_of_songs_in_SingStar_games_(PlayStation_3))

Lizenziert unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Metadaten (Jahr, Genre) werden über die [MusicBrainz API](https://musicbrainz.org/) abgerufen (Open Data, CC0).

---

## Lokale Entwicklung

```bash
npm install
npm run dev
```

### YouTube-Suche (Produktion)

Die eingebettete YouTube-Suche läuft über den serverseitigen Proxy
`public/api/yt-search.php` — der API-Key liegt ausschließlich auf dem
Webserver und ist nie Teil des JS-Bundles. Einrichtung:

1. Key in der [Google Cloud Console](https://console.cloud.google.com/) erstellen:
   YouTube Data API v3 aktivieren, API-Beschränkung auf **nur** YouTube Data API v3,
   niedriges Quota-Limit setzen (eine Suche kostet 100 Einheiten).
   **Keine** Referrer-Beschränkung — die Aufrufe kommen vom Server.
2. Per FTP eine Datei `usdx-editor-yt-key.php` **außerhalb des Webroots**
   ablegen — zwei Ebenen über dem Deploy-Verzeichnis, also neben dem
   Webroot-Ordner (z. B. `httpdocs/`):
   ```php
   <?php return 'AIza...dein-key...';
   ```
   Falls die Suche danach tot bleibt, blockiert der Hoster evtl. PHP-Zugriffe
   oberhalb des Webroots (`open_basedir`) — Details und Ausweichweg stehen im
   Kommentar-Header von `public/api/yt-search.php`.

Lokal (`npm run dev`) leitet der Vite-Dev-Server `api/`-Anfragen an die
Live-Site weiter (siehe `server.proxy` in `vite.config.ts`) — die eingebettete
Suche funktioniert also auch lokal, sobald der Proxy einmal deployt ist. Ein
lokaler Key oder PHP wird nicht benötigt. Ohne Internet/deployten Proxy meldet
die Suche „keine Ergebnisse", alles andere funktioniert normal.

```bash
npm test        # Unit-Tests
npm run build   # Produktions-Build
```

---

## Lizenz

GNU Affero General Public License v3.0 — siehe [LICENSE](./LICENSE).

Kurzfassung: Frei nutzbar, veränderbar und weiterggebbar — aber abgeleitete Werke und Dienste die auf diesem Code basieren müssen ebenfalls unter AGPL v3 veröffentlicht werden.

Developed with the assistance of Claude (Anthropic).

---

## Support

Wenn dir der Editor nützlich ist: ☕ [ko-fi.com/jankorczak](https://ko-fi.com/jankorczak)
