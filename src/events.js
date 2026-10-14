// -----------------------------------------------------------------------------
// Scene trigger detection.
//
// The scene triggers say "this happened": a departure became delayed, was
// cancelled, is about to leave; a disruption appeared on the network. Each
// one fires ONCE per trip (or per disruption), never once per poll, and the
// first read after a (re)start only learns what is already there: restarting
// the integration must not replay the events of the morning.
// -----------------------------------------------------------------------------

export const TRIGGERS = {
  DEPARTURE_DELAYED: 'departure_delayed',
  DEPARTURE_CANCELLED: 'departure_cancelled',
  DEPARTURE_IMMINENT: 'departure_imminent',
  NETWORK_DISRUPTION: 'network_disruption',
};

// A trip is forgotten this long after it was last listed.
const FORGET_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Remembers, per stop, which events each trip already fired.
 */
export function createDepartureTracker() {
  const stops = new Map();

  return {
    /**
     * Compare the departures just read with what was already notified.
     * @param {string} stopKey
     * @param {object[]} departures normalized departures of the stop
     * @param {{ now: number, delayThreshold: number, imminentMinutes: number }} options
     * @returns {{ trigger: string, departure: object }[]} the events to fire
     */
    track(stopKey, departures, { now, delayThreshold, imminentMinutes }) {
      const seeding = !stops.has(stopKey);
      const trips = stops.get(stopKey) ?? new Map();
      stops.set(stopKey, trips);

      const events = [];
      for (const departure of departures) {
        const trip = trips.get(departure.id) ?? { notified: new Set() };
        trip.lastSeen = now;
        trips.set(departure.id, trip);
        const { notified } = trip;
        const conditions = [
          [TRIGGERS.DEPARTURE_CANCELLED, departure.cancelled],
          [
            TRIGGERS.DEPARTURE_DELAYED,
            !departure.cancelled && departure.delayMinutes >= delayThreshold,
          ],
          [
            TRIGGERS.DEPARTURE_IMMINENT,
            imminentMinutes > 0 &&
              !departure.cancelled &&
              departure.expectedAt > now &&
              departure.expectedAt - now <= imminentMinutes * 60_000,
          ],
        ];
        for (const [trigger, happened] of conditions) {
          if (happened && !notified.has(trigger)) {
            notified.add(trigger);
            if (!seeding) {
              events.push({ trigger, departure });
            }
          }
        }
      }

      // Forget the trips not listed for a long time, so the memory stays small.
      for (const [id, trip] of trips) {
        if (now - trip.lastSeen > FORGET_AFTER_MS) {
          trips.delete(id);
        }
      }
      return events;
    },

    /** Forget a stop (or every stop): its next read seeds again. */
    reset(stopKey) {
      if (stopKey) {
        stops.delete(stopKey);
      } else {
        stops.clear();
      }
    },
  };
}

/**
 * Remembers the network disruptions already notified.
 */
export function createDisruptionTracker() {
  let known = null;

  return {
    /** @returns {object[]} the disruptions that just appeared */
    track(disruptions) {
      const ids = new Set(disruptions.map((disruption) => disruption.id));
      if (known === null) {
        known = ids;
        return [];
      }
      const fresh = disruptions.filter((disruption) => !known.has(disruption.id));
      // Only the current ones are kept: one that ends and comes back fires again.
      known = ids;
      return fresh;
    },

    reset() {
      known = null;
    },
  };
}
