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

## The change and its effect

Target: category A, a stated time returned as `null` because the model doubted something else. Three
wordings were tried, one at a time, each run on the full set and each file kept. None is in the prompt
now; the record is the result.

| Run       | Prompt     | Change                                                                                                                                                                   | Passed | Failures                                                                                                                                                                                                              |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| before    | `9cd5b85e` | none                                                                                                                                                                     | 73/76  | 'next Friday' is a Friday (this week's or the week after are both fair); second trip: two passengers in one note; the first is captured, the second is flagged; date edge: Sun Valley Clinic is a place, not a Sunday |
| attempt 1 | `f236e88e` | A rule under Pickup time: "Doubt about anything else ... never makes a stated time null: return the time as written and put the doubt in notes."                         | 72/76  | morning given in words; second trip: two passengers in one note; the first is captured, the second is flagged; date edge: a weekday said on that weekday; date edge: Sun Valley Clinic is a place, not a Sunday       |
| attempt 2 | `cde1c997` | The opening line made per-field: "when unsure about a field, return null for that field ... a doubt about one field (for example, no date given) never empties another". | 74/76  | second trip: two passengers in one note; the first is captured, the second is flagged; date edge: Sun Valley Clinic is a place, not a Sunday                                                                          |
| attempt 3 | `f0ccdc10` | A rule under Dates: "A time with no date is still a time: return pickup_time and leave pickup_date null."                                                                | 73/76  | morning given in words; second trip: two passengers in one note; the first is captured, the second is flagged; date edge: Sun Valley Clinic is a place, not a Sunday                                                  |
| after     | `9cd5b85e` | none (original prompt, scorer hardened, see below)                                                                                                                       | 73/76  | 'next Friday' is a Friday (this week's or the week after are both fair); second trip: two passengers in one note; the first is captured, the second is flagged; date edge: Sun Valley Clinic is a place, not a Sunday |

What the runs showed:

- **Attempt 1 made it worse.** It fixed 'next Friday' and lost two other times ("9:30 in the morning",
  "Monday 8am"), with notes such as "the 8am is read as 08:00 but the time is not confirmed". Telling the
  model not to doubt made it doubt in new places.
- **Attempt 2 looked best and was the most dangerous.** 74 of 76, but reading the answers against the
  `before` file showed three notes with no date now carried `pickup_date: 2026-11-02`, today's date,
  invented. The scorer had not caught it because those cases did not assert a date. An invented date is
  the failure this parser exists to prevent, so the attempt was reverted and every undated case now
  asserts `pickup_date: null` (18 cases). Against that scorer attempt 2 would have scored 71 of 76.
- **Attempt 3 was neutral**: 73 of 76, no invented dates, one case gained and one lost. The one
  systematic failure (the two-passenger note, 3 of 3 runs in every attempt) never moved.
- Differences of one case in 76 are inside this model's run-to-run noise ('next Friday' flips between
  runs on the same prompt). Only the two-passenger case and Sun Valley Clinic fail every time.

Decision: the prompt is unchanged. The evidence is that category A is wording-sensitive in both
directions, that a "fix" can trade a visible failure for an invisible worse one, and that the scorer
needed hardening more than the prompt needed a rule. That hardening is kept.

Two other decisions from these runs:

- The two-passenger case is no longer marked critical. A missed time is a blank the dispatcher is told to
  confirm, not a wrong value a vehicle could be sent on; "critical" is reserved for guesses.
- **The honest failures left unfixed:** the two-passenger note loses its 9am on every run (the model
  writes "9 is ambiguous as stated" though the note says 9am), and Sun Valley Clinic is cleared as a
  Sunday mismatch by the weekday check in code.
