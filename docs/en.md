# Belgian Mobility

Follow the public transport you use, anywhere in Belgium, from Gladys: the next
departures of your train station and of your metro, tram or bus stops, their
delays and cancellations, and the disruptions of the SNCB rail network.

| Operator    | Covers                                    | Source                               |
| ----------- | ----------------------------------------- | ------------------------------------ |
| SNCB / NMBS | Trains (platforms, delays, cancellations) | [iRail](https://docs.irail.be)       |
| STIB / MIVB | Brussels metro, trams and buses           | [Transitous](https://transitous.org) |
| De Lijn     | Flemish trams and buses                   | [Transitous](https://transitous.org) |
| TEC         | Walloon metro (Charleroi), trams, buses   | [Transitous](https://transitous.org) |

Both sources are free and open: **no account, no API key**. The integration
needs an internet connection (cloud).

## 1. Find your stops

- **A train station**: just type its name, in any official language: `Namur`,
  `Bruxelles-Central` or `Brussel-Centraal`, `Liège-Guillemins`.
- **A metro, tram or bus stop**: in the Configuration screen, click
  **Search a stop**, type its name (`De Brouckère`, `Gent Korenmarkt`,
  `Charleroi Palais`...) and copy the identifier shown after the arrow, e.g.
  `be-stib_6`.

## 2. Configure

| Field                 | What it does                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Stops to follow       | The stops, separated by `;`. Add `\| 71, 89` after a stop to keep only those lines (`IC`, `S`... for trains). |
| Language of the texts | English, French, German or Spanish: summaries, scene outputs, SNCB station names and disruptions.             |
| Delay alert           | A departure late by at least this many minutes fires **Departure delayed** (default 5).                       |
| Time to leave         | **Departure soon** fires when a departure is this many minutes away (default 10, 0 turns it off).             |
| SNCB network          | Adds the **SNCB network** device and the **New SNCB disruption** trigger.                                     |
| Refresh interval      | How often each stop is read, in seconds (60 minimum).                                                         |

Example: `Namur; be-stib_6 | 1, 5; Bruxelles-Central | IC`

Save, then open the **Discovery** tab of the integration to create the
devices. Click **Test the connection** to check that both sources answer.

## 3. Devices

Each followed stop becomes a device with three features:

- **Next departure in**: minutes until the next departure you can take;
- **Delay of the next departure**: in minutes, kept in history;
- **Next departure**: a summary, e.g. `14:47 S61 4586 → Wavre, Platform 5`.

The optional **SNCB network** device shows the latest disruption.

## 4. Scenes

Triggers (each one fires once per trip, never once per refresh):

- **Departure delayed**, **Departure cancelled**, **Departure soon**: filter on a
  stop, a line (`71`, `IC`) or a precise train (`IC 2113`). The following actions
  can use `line`, `vehicle`, `destination`, `delay_minutes`, `minutes`,
  `platform`, `scheduled_time`, `expected_time`...
- **New SNCB disruption**: a disruption or planned works on the rail network.

Actions:

- **Get the next departure** of a stop (optionally one line or one direction);
- **Plan a train journey** between two stations, now or at a given time;
- **Get the SNCB network status**.

Example: _every weekday at 7:15, get the next departure of Namur towards
Bruxelles; if `delay_minutes` > 5, send me "Your {{vehicle}} is
{{delay_minutes}} min late, platform {{platform}}"._

## 5. Dashboard widgets

- **Departures board**: the next departures of a stop (pick it in the widget
  settings) with delays, cancellations and platforms, and a refresh button;
- **SNCB network**: current disruptions and planned works.

## Good to know

- Real-time data depends on the operator: SNCB, De Lijn and TEC publish it;
  the STIB stops currently show the timetable (badge **Scheduled**).
- Only the stop identifiers and station names you configure are sent to iRail
  and Transitous. Nothing else leaves your Gladys.
- A stop marked as unknown in the connection status: check its spelling or use
  **Search a stop**.
