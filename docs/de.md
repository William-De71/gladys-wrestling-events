# Wrestling Events

## Überblick

Diese Integration bringt das Programm des Profi-Wrestlings in Gladys: die Shows von **WWE, AEW, NJPW, TNA, AAA, ROH, CMLL, Stardom, AJPW, DDT, Dragon Gate, GCW, RevPro und MLP**, ausgewählt in einer Liste. Jede verfolgte Promotion wird ein **Kalender** für jeden Benutzer, der die Integration aktiviert, mit Uhrzeit, Halle und Card jeder Show. Szenen reagieren vor dem ersten Gong, wenn eine Show angekündigt wird oder wenn Matches zu einer Card hinzukommen, und zwei Dashboard-Widgets zeigen, was ansteht.

Das Programm stammt von [TheSportsDB](https://www.thesportsdb.com), einer offenen Sportdatenbank, die ihre Community aktuell hält. Ein Konto ist nicht nötig: Die Integration nutzt den kostenlosen Schlüssel von TheSportsDB oder Ihren Premium-Schlüssel, falls Sie einen haben.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer (Kalenderintegrationen).
- Internetzugang.
- Optional: ein Premium-Schlüssel von TheSportsDB, für 60 oder 90 Tage im Voraus und schnelleres Lesen.

## Konfiguration

| Feld                             | Beschreibung                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Promotions                       | Die zu verfolgenden Promotions, je ein Kalender. Standardmäßig WWE, AEW, NJPW, TNA und AAA.                |
| Arten von Shows                  | Wöchentliche TV-Shows (RAW, SmackDown, Dynamite …), Tour-Shows („Day 1“ …) und Großevents (PLE, Specials). |
| Programm im Voraus               | 2 Wochen oder 30 Tage (Standard); 60 oder 90 Tage brauchen einen Premium-Schlüssel.                        |
| Premium-API-Schlüssel (optional) | Leer lassen, um den kostenlosen Schlüssel zu nutzen.                                                       |
| Sprache der Szenentexte          | Die Sprache des Satzes der Szenenaktion „nächste Show“. Automatisch: die Sprache des Dashboards.           |

Speichern Sie und drücken Sie dann auf derselben Seite unter **Meine Kalender** auf **Für mich aktivieren**. Jeder Benutzer, der die Kalender möchte, aktiviert die Integration für sich selbst.

Mit dem kostenlosen Schlüssel fragt die Integration einen Tag einer Promotion nach dem anderen ab, eine Anfrage alle 7 Sekunden, um im Rahmen dessen zu bleiben, was TheSportsDB erlaubt: Das erste Lesen von 30 Tagen für 5 Promotions dauert etwa 20 Minuten. Der Status der Integration zeigt den Fortschritt. Weniger Promotions oder nur 2 Wochen gehen schneller.

## Verwendung

### Kalender

Jede verfolgte Promotion ist ein Kalender namens „Wrestling – WWE“ in der Farbe der Promotion, mit:

- einem Termin pro Show, vom Beginn bis zu einem geschätzten Ende (2 Stunden für eine TV-Show, 3 für eine Tour-Show, 4 für ein Großevent), wenn die Uhrzeit bekannt ist, oder einem **ganztägigen Termin**, wenn TheSportsDB die Uhrzeit noch nicht kennt;
- Halle, Stadt und Land als Ort, der Card (ein Match pro Zeile) und der Art der Show als Beschreibung und einem Link zur Seite der Show auf TheSportsDB;
- den Shows von vor 7 Tagen bis zum gewählten Horizont. Eine abgesagte Show verschwindet, eine verschobene zieht mit.

Ein neuer Kalender ist **privat**. Schalten Sie unter **Meine Kalender** **Mit dem Haushalt teilen** ein, um ihn in den Szenen des Haushalts zu nutzen (auch mit dem eingebauten Auslöser „Kalenderereignis steht bevor“), oder schalten Sie **Diesen Kalender synchronisieren** aus, um ihn auszulassen. Eine aus der Konfiguration entfernte Promotion löscht ihren Kalender.

### Dashboard-Widgets

![Die zwei Widgets: die nächsten Shows von WWE und NJPW und der Countdown bis RAW mit seiner Card (generierte Illustration, kein Screenshot; erfundene Poster)](https://raw.githubusercontent.com/William-De71/gladys-wrestling-events/main/docs/assets/widgets.de.png)

- **Nächste Wrestling-Shows**: die nächsten 3, 5 oder 8 Shows mit Datum, Uhrzeit, Halle, einem Abzeichen pro Promotion (blau: TV-Show, hellblau: Tour-Show, rot: Großevent) und dem Poster. Tippen Sie auf eine Show, um ihre Card zu lesen.
- **Nächste Wrestling-Show**: der Countdown bis zur nächsten Show, ihre Uhrzeit, die Zahl der angekündigten Matches, das Poster, die Halle und die Card.

Beide lassen sich in ihren Einstellungen auf bestimmte Promotions oder Arten von Shows beschränken.

### Szenen

Auslöser (Filter: Promotions und Arten von Shows):

- **Wrestling: eine Show beginnt**: zu Beginn oder 15, 30, 60 bzw. 120 Minuten vorher (unter „Wann“ wählen). Nur für Shows mit bekannter Uhrzeit.
- **Wrestling: neue Show angekündigt**: Eine Show kommt zum Programm einer verfolgten Promotion hinzu.
- **Wrestling: Matches zur Card hinzugefügt**: Neue Matches erscheinen auf der Card einer kommenden Show; `new_matches` listet sie auf.

Die Variablen der Shows: `title` („WWE – Crown Jewel“), `name`, `promotion`, `promotion_name`, `kind` (weekly, tour, special), `date`, `time`, `venue`, `city`, `country`, `place`, `card`, `url`.

Aktion: **Wrestling: nächste Show** liefert die nächste Show bestimmter Promotions oder Arten: Titel, Datum, Uhrzeit, Ort, Minuten bis zum Beginn, Card, Link und einen fertigen Satz `text`.

Beispiele:

- Wenn **ein Großevent von WWE oder AEW in 15 Minuten beginnt** → Fernseher einschalten und das Wohnzimmer dimmen.
- Wenn **eine neue NJPW-Show angekündigt wird** → `{{triggerEvent.data.title}}, {{triggerEvent.data.date}} in {{triggerEvent.data.city}}` senden.
- Jeden Montag um 9 Uhr → **Wrestling: nächste Show**, dann ihren `text` per Telegram senden.

### Transport

Nur Cloud. Nur die gewählten Promotions und die abgefragten Tage gehen über das Internet an TheSportsDB; die Poster der Widgets werden von TheSportsDB geladen, wenn ein Dashboard sie zeigt. Nichts über Sie oder Ihr Zuhause verlässt Ihr Netzwerk.

## Fehlerbehebung

- **Die Kalender bleiben leer**: Prüfen Sie, ob Sie unter Meine Kalender auf **Für mich aktivieren** gedrückt haben, und warten Sie das erste Lesen ab (der Status der Integration zeigt den Fortschritt).
- **„TheSportsDB bittet um weniger Anfragen“**: Der kostenlose Schlüssel wird von allen geteilt; die Integration wartet 15 Minuten und macht von selbst weiter.
- **„TheSportsDB lehnt den API-Schlüssel ab“**: Prüfen Sie den Premium-Schlüssel oder leeren Sie das Feld, um den kostenlosen Schlüssel zu nutzen.
- **Eine Show hat keine Uhrzeit**: TheSportsDB ergänzt die Uhrzeit oft wenige Tage vorher; der ganztägige Termin erhält sie dann von selbst. Der Auslöser „eine Show beginnt“ greift erst, wenn die Uhrzeit bekannt ist.
- **Eine Show fehlt**: TheSportsDB wird von seiner Community gepflegt, und der kostenlose Schlüssel liefert höchstens 3 Shows pro Promotion und Tag (CMLL kann mehr haben). Ein Premium-Schlüssel liest ganze Saisons.
- **Eine Show hat die falsche Art**: Die Art wird aus dem Namen abgeleitet (eine Nummer „#1743“ bedeutet TV-Show, „Day 3“ Tour-Show). Melden Sie es mit dem Namen der Show.
- **Keine Szene startet**: Die Auslöser der Integration brauchen keine Freigabe, aber „eine Show beginnt“ braucht die Uhrzeit der Show und „neue Show angekündigt“ einen bereits einmal gelesenen Tag. Der eingebaute Auslöser „Kalenderereignis steht bevor“ sieht nur mit dem Haushalt geteilte Kalender.

Geben Sie in einem Fehlerbericht die Versionen von Gladys und der Integration an, die verfolgten Promotions, kostenlosen oder Premium-Schlüssel und die Zeilen des Reiters Protokolle der Integration; im Entwicklermodus ergänzt `DEBUG=gladys-integration-sdk` die SDK-Protokolle.
