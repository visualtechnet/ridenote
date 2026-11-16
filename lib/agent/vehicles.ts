import { AGENT } from "../config";
import type { Trip } from "../trip";

export type VehicleClass = "wheelchair_van" | "stretcher_van" | "sedan";

/** The vehicle a rider's mobility needs, or null when it is not known well enough to choose one. */
export function vehicleClassFor(mobility: Trip["mobility"]): VehicleClass | null {
  if (mobility.length === 0 || mobility.includes("other")) return null;
  if (mobility.includes("stretcher")) return "stretcher_van";
  if (mobility.includes("wheelchair") || mobility.includes("scooter")) return "wheelchair_van";
  return "sedan";
}

/** The fake vehicle service fails on one day of the month. `date` is a YYYY-MM-DD string. */
export function vehicleServiceDown(date: string): boolean {
  return Number(date.slice(8, 10)) === AGENT.serviceDownDayOfMonth;
}
