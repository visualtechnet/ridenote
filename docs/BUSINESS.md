This page is for people who run or buy the service, not for the people who build it. It explains
what RideNote does, what it will and will not do, and what to expect. The developer pages are
linked at the end.

## What RideNote does, in one sentence

A dispatcher types a short note about a ride, and RideNote turns it into a clear trip card that
someone can check and act on.

> "Pick up Mrs. Lee at 12 Oak St at 9:30am, taking her to County Hospital. She uses a wheelchair."

becomes a card with the passenger, the pickup place and time, the drop-off, the date, and any
mobility aid the passenger needs.

## Why it helps

- **Less retyping.** The dispatcher writes the note once, in their own words. The trip card fills in
  itself.
- **Nothing is invented.** If the note does not say something, the card says **Missing** in that
  spot. It never fills the gap with a guess.
- **A person always decides.** A trip is saved only when someone clicks **Approve**.

## Two ways to use it

**1. Parse a note.** Paste or type the note and press **Parse**. You get the trip card in a few
seconds. Use this for a quick, single note.

**2. Ask the agent.** The agent goes further. It can look up the rider in your list, check whether a
suitable vehicle is free, and propose a trip for a person to approve. If the note is unclear, it
asks the dispatcher a short question with buttons to answer, instead of guessing. Use this when the
ride needs more than a card.

## What it will not do

- It will not book a vehicle, send a message to a passenger, or change anything in another system.
- It will not save a trip on its own. Only an **Approve** click saves one.
- It will not follow instructions hidden inside a note. A note that says "ignore your rules" is read
  as a note, not as a command.
- It will not accept HTML, code or script links. Those are refused with a plain message.

## Your information

- **The note is not kept.** RideNote does not store the text a dispatcher types.
- **Only the trip is saved, and only when approved.** Contact details are removed first.
- **Saved trips are deleted after 7 days.** A daily clean-up removes older ones automatically.
- **Saving is turned on only for the live service.** On a test or a personal copy, nothing is saved.

## Limits you may run into

- **The demo has a fixed monthly budget.** It is shared by everyone. When the budget is used up, the
  page says so and stays unavailable until the budget renews. The demo never spends past that cap.
- **Busy moments.** At a peak, you may see "We're handling a lot of requests right now." Wait a
  moment and try again. Nothing you typed is lost, so press the button again.
- **Too many quick requests.** If you press the button very fast, you are asked to wait a few
  seconds. Those seconds are shown on the screen.
- **A slow connection.** If the connection drops while you are sending a note, you are told to try
  again. Nothing is half-saved.

## What "Missing" means

A card marks a field **Missing** when the note did not say it. Common examples are the pickup date,
the pickup time, or the mobility aid. Confirm those with the caller before you dispatch. The card
also tells you why a date needs checking, for example when the date has already passed.

## How accurate is it?

RideNote is tested against a fixed set of example notes, including tricky ones. The results are
published on the **Eval** page, with the number of notes that passed and the ones that failed. The
Eval page shows the date of the most recent run. A card is still a draft until a person approves it, so the
dispatcher should always look at the card before acting on it.

## Words you will see

- **Note.** The free text a dispatcher types about one ride.
- **Trip card.** The structured result: passenger, pickup, drop-off, date, time, mobility.
- **Missing.** The note did not say this. It was not guessed.
- **Parse.** Turn a note into a trip card.
- **Agent.** The assistant that can look things up, propose a trip and ask a question.
- **Approve.** A person's click that saves a proposed trip.
- **Mobility aid.** A wheelchair, stretcher, walker, cane or similar. "Ambulatory" means the
  passenger walks without an aid.

## Common questions

**Does it replace the dispatcher?** No. It writes the first draft of the trip card. A person checks
it and approves it.

**Can it make a mistake?** Yes, like any tool. That is why every field it could not confirm is
marked Missing, and why nothing is saved without an approval.

**Where does it run?** On a hosted web service, with a language model from Anthropic doing the
reading. The note is sent to that model to be read.

**What happens if something breaks?** You get a short, plain message and a suggestion to try again.
The owner is told what kind of failure it was, but the note itself is never written to the logs.

**Who can see the trips?** The public History page shows recent trips from the live service only.
Test copies show nothing.

## Where to read more

- **Eval:** how accuracy is measured, with the results.
- **FAQ:** common questions and the lessons from building it.
- **Agent:** how the agent works, in plain steps, for people new to AI.
- **Docs:** setup instructions for a developer.
