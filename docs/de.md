# Belgian Mobility

Verfolgen Sie in Gladys die öffentlichen Verkehrsmittel, die Sie nutzen,
überall in Belgien: die nächsten Abfahrten Ihres Bahnhofs und Ihrer U-Bahn-,
Tram- oder Bushaltestellen, deren Verspätungen und Ausfälle sowie die Störungen
im SNCB-Bahnnetz.

| Verkehrsbetrieb | Umfang                                    | Quelle                               |
| --------------- | ----------------------------------------- | ------------------------------------ |
| SNCB / NMBS     | Züge (Gleise, Verspätungen, Ausfälle)     | [iRail](https://docs.irail.be)       |
| STIB / MIVB     | U-Bahn, Trams und Busse in Brüssel        | [Transitous](https://transitous.org) |
| De Lijn         | Trams und Busse in Flandern               | [Transitous](https://transitous.org) |
| TEC             | U-Bahn (Charleroi), Trams, Busse Wallonie | [Transitous](https://transitous.org) |

Beide Quellen sind frei und offen: **kein Konto, kein API-Schlüssel**. Die
Integration benötigt eine Internetverbindung (Cloud).

## 1. Haltestellen finden

- **Ein Bahnhof**: geben Sie einfach seinen Namen ein, in jeder Amtssprache:
  `Namur`, `Bruxelles-Central` oder `Brussel-Centraal`, `Liège-Guillemins`.
- **Eine U-Bahn-, Tram- oder Bushaltestelle**: klicken Sie in der Konfiguration
  auf **Haltestelle suchen**, geben Sie den Namen ein (`De Brouckère`,
  `Gent Korenmarkt`...) und kopieren Sie die Kennung hinter dem Pfeil, z. B.
  `be-stib_6`.

## 2. Konfigurieren

- **Haltestellen**: getrennt durch `;`. Mit `| 71, 89` hinter einer Haltestelle
  bleiben nur diese Linien (`IC`, `S`... bei Zügen). Beispiel:
  `Namur; be-stib_6 | 1, 5; Bruxelles-Central | IC`.
- **Sprache der Texte**: Englisch, Französisch, Deutsch oder Spanisch.
- **Verspätungsalarm**: ab so vielen Minuten Verspätung wird **Abfahrt
  verspätet** ausgelöst (Standard 5).
- **Zeit zum Aufbruch**: **Abfahrt in Kürze** wird ausgelöst, wenn eine Abfahrt
  so viele Minuten entfernt ist (Standard 10, 0 schaltet es ab).
- **SNCB-Netz**: fügt das Gerät **SNCB-Netz** und den Auslöser **Neue
  SNCB-Störung** hinzu.
- **Aktualisierungsintervall**: in Sekunden (mindestens 60).

Speichern Sie und öffnen Sie dann den Reiter **Erkennung**, um die Geräte
anzulegen. **Verbindung testen** prüft, ob beide Quellen antworten.

## 3. Geräte

Jede Haltestelle wird ein Gerät mit drei Funktionen: **Nächste Abfahrt in**
(Minuten), **Verspätung der nächsten Abfahrt** (Minuten, mit Verlauf) und
**Nächste Abfahrt** (Zusammenfassung, z. B. `14:47 S61 4586 → Wavre, Gleis 5`).

## 4. Szenen

Auslöser (einmal pro Fahrt): **Abfahrt verspätet**, **Abfahrt entfällt**,
**Abfahrt in Kürze** (Filter: Haltestelle, Linie, bestimmter Zug) und **Neue
SNCB-Störung**. Variablen: `line`, `vehicle`, `destination`, `delay_minutes`,
`minutes`, `platform`...

Aktionen: **Nächste Abfahrt abrufen**, **Zugreise planen** (zwischen zwei
Bahnhöfen, jetzt oder zu einer Uhrzeit), **SNCB-Netzstatus abrufen**.

## 5. Widgets

**Abfahrtstafel** (die nächsten Abfahrten einer Haltestelle) und **SNCB-Netz**
(aktuelle Störungen und geplante Bauarbeiten).

## Gut zu wissen

Echtzeitdaten hängen vom Verkehrsbetrieb ab: SNCB, De Lijn und TEC
veröffentlichen sie, die STIB-Haltestellen zeigen derzeit den Fahrplan
(Kennzeichen **Planmäßig**). Nur die konfigurierten Haltestellen werden an iRail und Transitous
gesendet.
