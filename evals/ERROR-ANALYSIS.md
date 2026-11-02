# Error analysis of the parser on the messier set

Date: 2026-11-02. Model `claude-haiku-5-5`, prompt `9cd5b85e`, file
`evals/results/2026-11-02-claude-haiku-5-5-before.json`: 73 of 76 cases passed (96%),
1 critical failure, 148 calls, $0.0426, 1541 ms per call.

Method, from Lesson 3: run every case and keep the answers (the results file); read each answer and
write one line on the first thing wrong with it (open coding); group the lines into categories and count
them (axial coding); fix the biggest category in the prompt, once, and measure again. Every note is
invented.

## Open coding

Every failing case, then the 24 messier cases that passed, read answer by answer. "Nothing wrong" is
recorded when the answer was right and the note said why.

| Case                                                                        | First thing wrong with the answer                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 'next Friday' is a Friday                                                   | Note: "Pick up Mrs. Diaz at 40 Bay St next Friday at 2pm for Mercy Hospital.". The model wrote "'2pm' with no AM or PM marking, so pickup time is unclear" and returned `null`. 2pm has PM. Date, name, addresses right. Failed 2 of 3 runs; also the one failure on the tidy set earlier today. |
| second trip: two passengers (critical)                                      | Time `null` with the note "9am is 09:00 but ... not clearly stated as 9am pickup versus appointment". It found the first trip, the right aid, and flagged Mrs Soto correctly, then threw away a stated time over a doubt that belongs in notes. Failed 3 of 3.                                   |
| date edge: Sun Valley Clinic                                                | The model resolved 11/5 to 2026-11-05 correctly. Code cleared it: "Sun" in the clinic's name matches the short weekday form in `lib/dates.ts`, so the Thursday is reported as a Sunday mismatch. A code limit, not a model error.                                                                |
| shorthand: PU, d/o and w/c                                                  | Dropoff came back as "St Clare's Hosp, d/o main ent": the marker `d/o` was left inside the field. Everything else right; `w/c` read as wheelchair. Passed on the pattern.                                                                                                                        |
| shorthand: RT 1700                                                          | First trip right. Notes call "RT 1700" "unclear, may refer to a return trip time": understood, hedged.                                                                                                                                                                                           |
| shorthand: STR                                                              | Right, including "2 attendants" noted as not in the schema.                                                                                                                                                                                                                                      |
| shorthand: amb                                                              | Right: `ambulatory` from "amb, no aids".                                                                                                                                                                                                                                                         |
| ALL CAPS (three cases)                                                      | All right. Names normalised to mixed case; 1030AM and 2PM converted; "NO TIME GIVEN YET" became `null` with both blanks flagged.                                                                                                                                                                 |
| typos (three cases)                                                         | All right; "dialisis at Lakeside" became "Lakeside dialysis"; "strecher" became stretcher.                                                                                                                                                                                                       |
| two addresses (three cases)                                                 | All right: the pharmacy stop, the billing address and the home address each stayed out of the wrong field, and the notes said what was left out.                                                                                                                                                 |
| contact detail (three cases)                                                | All right: no phone number or email reached a name or an address; each note said the contact detail is not trip data.                                                                                                                                                                            |
| noise (three cases)                                                         | All right, including the trip quoted inside a forwarded thread.                                                                                                                                                                                                                                  |
| second trip: there and back                                                 | Right, with the return at 15:00 flagged in notes.                                                                                                                                                                                                                                                |
| date edge: today, tonight, day after tomorrow, the 15th, Monday on a Monday | All right. "Tonight at 7" became 19:00 on today's date; "the 15th" became 2026-11-15; Monday on a Monday became today, as the prompt says.                                                                                                                                                       |

## Axial coding

| Category                                                                                                                        | Count                          | Example                       | Prompt-fixable?                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. A stated time is returned as `null` because the model doubts something else (the day, which trip, pickup versus appointment) | 2, both failures, one critical | "2pm" and "9am" lost          | Yes: the rule that a time with AM or PM is never ambiguous exists; it needs to say that doubt about anything else goes in notes and never empties the time. |
| B. Code clears a real date because a place name contains a weekday abbreviation                                                 | 1                              | Sun Valley Clinic             | No: `lib/dates.ts` short-form weekday match. Left as the honest failure; fix is on the review's Later list.                                                 |
| C. A shorthand marker is left inside a field                                                                                    | 1 (a pass)                     | "d/o main ent" in the dropoff | Yes, a glossary line; not the biggest category.                                                                                                             |
| D. A second trip is understood but phrased as uncertain                                                                         | 1 (a pass)                     | "RT 1700 ... unclear"         | Marginal; notes are free text.                                                                                                                              |

Largest category: **A**. It caused both model failures on this set, including the only critical one,
and the one failure on the tidy set. Task 6 changes the prompt for A and nothing else.

What the messier set did not break, which is worth saying because the review predicted some of it:
shorthand aids, capitals, typos, third addresses, contact details and pasted email noise all parsed
correctly on every run.
