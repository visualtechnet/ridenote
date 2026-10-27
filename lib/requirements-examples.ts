import type { Trip } from "./trip";

/** Sample responses shown on the Requirements page. A test checks each one against TripSchema. */
export const OUTPUT_EXAMPLES: { title: string; note: string; trip: Trip }[] = [
  {
    title: "Everything stated",
    note: "Pick up Mrs. Lee at 12 Oak St at 9:30am, taking her to County Hospital. She uses a wheelchair.",
    trip: {
      passenger_name: "Mrs. Lee",
      pickup_location: "12 Oak St",
      dropoff_location: "County Hospital",
      pickup_time: "09:30",
      mobility: ["wheelchair"],
      missing_fields: [],
      notes: "",
    },
  },
  {
    title: "Some fields missing",
    note: "Pick up Mr. Davis at 44 Pine Ave at 2pm.",
    trip: {
      passenger_name: "Mr. Davis",
      pickup_location: "44 Pine Ave",
      dropoff_location: null,
      pickup_time: "14:00",
      mobility: [],
      missing_fields: ["dropoff_location", "mobility"],
      notes: "",
    },
  },
  {
    title: "Ambiguous note",
    note: "Take Ana to the clinic around lunch, she needs help getting around.",
    trip: {
      passenger_name: "Ana",
      pickup_location: null,
      dropoff_location: "the clinic",
      pickup_time: null,
      mobility: [],
      missing_fields: ["pickup_location", "pickup_time", "mobility"],
      notes: "Time is vague (around lunch) and the level of help needed is unclear.",
    },
  },
];
