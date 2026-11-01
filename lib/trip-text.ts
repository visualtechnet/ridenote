import { formatDate, formatTime12h, mobilityLabel, splitDateReason } from "./format";
import { COPY } from "./messages";
import type { Trip } from "./trip";

/**
 * The card as plain text, one labelled line per field, for pasting into a scheduling system. It says
 * exactly what the card says: a blank is written as "Not stated" (never left out, so a gap cannot pass
 * unnoticed), a cleared date carries its reason, and the parser's note comes last, only when there is one.
 */
export function tripToText(trip: Trip): string {
  const blank = COPY.notStated;
  const { dateReason, rest } = splitDateReason(trip.notes);
  const date = trip.pickup_date ? formatDate(trip.pickup_date) : blank;
  const lines = [
    `${COPY.fieldPassenger}: ${trip.passenger_name ?? blank}`,
    `${COPY.fieldPickupDate}: ${date}${dateReason ? ` (${dateReason})` : ""}`,
    `${COPY.fieldPickupTime}: ${trip.pickup_time ? formatTime12h(trip.pickup_time) : blank}`,
    `${COPY.fieldPickup}: ${trip.pickup_location ?? blank}`,
    `${COPY.fieldDropoff}: ${trip.dropoff_location ?? blank}`,
    `${COPY.fieldMobility}: ${trip.mobility.length ? trip.mobility.map(mobilityLabel).join(", ") : blank}`,
  ];
  if (rest) lines.push(`${COPY.notesLabel}: ${rest}`);
  return lines.join("\n");
}
