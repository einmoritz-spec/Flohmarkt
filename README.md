# Standkasse

Kleine Web-App fürs Tracking von Verkäufen am Flohmarktstand: Bestand, Preise mit Mengenrabatt,
Verkaufshistorie und Auswertung. Läuft komplett offline im Browser, keine Anmeldung, keine
Server-Anbindung — alle Daten liegen lokal auf dem Gerät (`localStorage`).

## Auf GitHub Pages veröffentlichen

1. Diesen Ordner in ein neues GitHub-Repository hochladen (die Dateien müssen im Root liegen,
   nicht in einem Unterordner).
2. Im Repo unter **Settings → Pages** als Quelle den `main`-Branch, Root-Verzeichnis auswählen.
3. Nach ein bis zwei Minuten ist die App unter `https://<username>.github.io/<repo-name>/` erreichbar.

## Als App installieren (Chrome)

1. Die GitHub-Pages-URL in Chrome öffnen (Desktop oder Android).
2. Rechts in der Adressleiste auf das Installieren-Symbol tippen, bzw. Menü → „App installieren".
3. Die App liegt danach wie eine normale App auf dem Homescreen / im Startmenü und startet auch
   ohne Internetverbindung.

Auf iPhone/Safari geht's über „Teilen → Zum Home-Bildschirm".

## Bilder später einfügen

Aktuell zeigt jede Kachel einen Platzhalter. Sobald echte Fotos der Motive da sind:

1. Bilder z. B. unter `icons/motive/` im Repo ablegen (Dateiname = Motivname, z. B. `ginkgo.jpg`).
2. In `app.js` in der Funktion `renderSell()` die Zeile mit `motifIcon()` durch ein `<img>`-Tag
   ersetzen, das auf `icons/motive/<dateiname>` zeigt. Am einfachsten: jedem Motiv in `data.js`
   ein Feld `image: "ginkgo.jpg"` geben und das im Tile-Template verwenden.

## Daten sichern

Unter **Einstellungen → Backup exportieren** lässt sich der komplette Stand (Bestände, Preise,
Historie) als JSON-Datei herunterladen — praktisch als Sicherung vor und nach dem Markt, oder um
zwischen zwei Geräten umzuziehen (**Backup importieren**).

## Struktur

- `index.html` – Grundgerüst und Navigation
- `style.css` – Design
- `data.js` – Standard-Konfiguration (Kategorien, Motive, Preisstaffeln)
- `app.js` – gesamte App-Logik
- `manifest.json` / `sw.js` – macht die Seite installierbar und offline-fähig
- `icons/` – App-Icons (Platzhalter)
