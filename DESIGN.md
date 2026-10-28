---
name: RideNote
description: Dispatcher notes, turned into trips. A dark console that shows a blank rather than a guess.
colors:
  glass: "#0b0f14"
  panel: "#111720"
  panel-raised: "#172030"
  well: "#070b10"
  etch: "#232c38"
  etch-strong: "#334152"
  edge: "#63758b"
  ink: "#d5dee9"
  ink-dim: "#93a1b3"
  ink-bright: "#f1f5f9"
  accent: "#59b8ff"
  accent-hover: "#8dd0ff"
  accent-ink: "#04121f"
  missing: "#fcd34d"
  missing-edge: "#fbbf24"
  danger: "#f87171"
  danger-ink: "#fca5a5"
  danger-wash: "#450a0a"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    letterSpacing: "0.14em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "Sometype Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "Sometype Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    letterSpacing: "0.14em"
rounded:
  none: "0px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "40px"
components:
  key:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.none}"
    height: "44px"
    padding: "0 20px"
  key-run:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    height: "44px"
    padding: "0 28px"
  key-run-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-ink}"
  bezel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.none}"
    padding: "20px"
  field-input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink-bright}"
    typography: "{typography.data}"
    rounded: "{rounded.none}"
    padding: "12px"
  chip-aid:
    textColor: "{colors.accent}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
  chip-missing:
    textColor: "{colors.missing}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
---

# Design System: RideNote

## Overview

**Creative North Star: "The Dispatch Console"**

RideNote looks like a control-room desk at night. The page is a near-black glass (`#0b0f14`); every group of information sits in a flat, etched panel; labels are small mono capitals; values are mono; and one lit blue (`#59b8ff`) marks what you can act on. The visitor pastes a note and reads a card as they would read a console readout: each field has a label, a value, or an honest blank.

The design is bold and confident where it speaks (large condensed caps for the name and the passenger, a full-fill accent key for Parse) and austere everywhere else. It does not decorate. Colour, type and border carry state: blue means action or an identified aid, amber means something is missing, red means something failed, and a dashed blank slot means the note did not say.

This is a dark-only system by decision: the app sets `color-scheme: dark` and the `dark` class on `<html>`, and there is no light theme to maintain.

**Key Characteristics:**

- Square corners, 1px etched borders, flat panels.
- Three voices: condensed caps for headings and keys, mono for data and labels, a humanist sans (Atkinson Hyperlegible) for reading text.
- One accent. Amber and red are reserved for Missing and errors.
- Unstated fields are dashed blank slots reading "Not stated", never styled like data.
- Every interactive target is 44px tall.

## Colors

A cool blue-grey dark palette with a single sky-blue accent; the neutrals replace Tailwind's zinc so existing `zinc-*` classes take the same palette.

### Primary

- **Signal Blue** (`#59b8ff`): the one accent. Parse key fill, links on hover, current-page nav, selected-state edges, mobility-aid chips, the character-count bar, focus rings. **Signal Blue Hover** (`#8dd0ff`) lifts it on hover. **Accent Ink** (`#04121f`) is the text colour on any blue fill (8.8:1).

### Neutral

- **Glass** (`#0b0f14`): the page background and scrollbar track.
- **Panel** (`#111720`): result card, History rows, the sticky bar's tone.
- **Panel Raised** (`#172030`): the resting face of a key.
- **Well** (`#070b10`): the textarea's recessed background.
- **Etch** (`#232c38`) and **Etch Strong** (`#334152`): decorative dividers and panel borders only; both are under 2:1 against the glass and must not identify a control.
- **Edge** (`#63758b`): the border that does identify something: the textarea outline and the dashed "Not stated" underline. 4.1:1 on the glass, 3.8:1 on a panel.
- **Ink** (`#d5dee9`): body text. **Ink Dim** (`#93a1b3`): labels and secondary text (6.8:1 or better). **Ink Bright** (`#f1f5f9`): values and headings.

### Semantic

- **Missing Amber** (`#fcd34d`, border `#fbbf24`): the "Missing" chips and the quiet "confirm mobility" line. The unused `--amber` token (`#ffb000`) is a leftover, not part of the system.
- **Danger Red** (`#f87171`, text `#fca5a5`, wash `#450a0a`): validation and upstream errors.

### Named Rules

**The Blank Is Not Data Rule.** An unstated field is a dashed `Edge` underline and the words "Not stated" in italic dim text. It never takes the value style, a placeholder dash, or the accent.

**The One Lit Colour Rule.** Blue is the only colour that says "this is live or chosen." Amber and red say "missing" and "failed" and are never used for emphasis.

**The Edge Rule.** Anything a person must see to find or operate a control uses `Edge` (3:1 or better); `Etch` tones are scenery.

## Typography

**Display Font:** Barlow Condensed (600, 700, 800; fallback Arial Narrow)
**Body Font:** Atkinson Hyperlegible Next (fallback system-ui)
**Label/Mono Font:** Sometype Mono

**Character:** A signage-grade humanist sans for anything read at length, a narrow caps face for names and commands, and a mono for everything measured or entered. Atkinson was chosen for legibility, which suits the accessibility commitment.

### Hierarchy

- **Display** (800, 3.75rem to 4.5rem, line-height 0.9, tracking 0.04em, caps, accent): the RideNote title on the parser page.
- **Headline** (700, 1.5rem, tracking 0.14em, caps): passenger name on a result or History card.
- **Key label** (800, 1.0625rem, tracking 0.2em, caps): text on every key.
- **Body** (400, 1rem, 1.5): intro and docs prose in Ink at 65 to 75ch; docs set the measure through the 768px column.
- **Data** (mono, 1rem, Ink Bright): values on the card, note text in the textarea (15px).
- **Label** (mono, 0.6875rem, tracking 0.14em, caps, Ink Dim): field names, the usage line label, character count. Times and counts use tabular numerals.

### Named Rules

**The Mono Is For Measurements Rule.** Mono carries entered text, field values, times, counts and labels; reading copy never uses it.

## Layout

A single centred column: `max-w-3xl` (768px) with 16px side padding (24px from 640px) and 40px (56px from 640px) top padding, 24px between blocks. Navigation is a sticky bar across the top (64px high from 768px, `bg-zinc-950/95` with a light blur), links in one row; below 768px the links fold behind a Menu button. Result fields sit in a two-column grid on 640px and up with 1px gaps that read as ruled lines, one column below. Docs pages use the same column with `mt-10` between sections.

Spacing rhythm: 8, 12, 20, 24, 40. Tight inside a field (6px between label and value), generous between blocks.

## Elevation & Depth

Flat by default. Depth is tonal: Glass, then Panel, then Panel Raised, then Well for recessed inputs. Panels have a 1px Etch Strong border and no shadow. Only keys carry a shadow, and it responds to touch.

### Shadow Vocabulary

- **Key rest** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.5)`): a lit top edge and a short drop; the key looks raised.
- **Key pressed** (`box-shadow: inset 0 2px 4px rgba(0,0,0,0.6)` with `translateY(1px)`): the key sinks.
- **Input focus** (`0 0 0 4px` accent at 18%, red at 20% when invalid): a glow ring paired with a border change to Signal Blue.

### Named Rules

**The Flat At Rest Rule.** Panels never cast shadows. If something looks raised, it is a key.

## Shapes

No rounded corners anywhere in the app: `border-radius: 0` on panels, keys, inputs, chips and the error alert. Borders are 1px (2px for the dashed blank underline and the count bar). Chips are outlined rectangles with mono caps text, not pills.

## Components

### Buttons ("keys")

Bold and confident. 44px minimum height, Barlow Condensed 800 at 1.0625rem, tracking 0.2em, caps.

- **Primary (`.key.run`):** Signal Blue fill, Accent Ink text, 28px horizontal padding. Hover lifts to Signal Blue Hover.
- **Secondary (`.key`):** Panel Raised face, 1px Etch Strong border, Ink text. Hover brightens the border to Ink Dim and the text to near-white.
- **Ghost (Clear):** caps text in zinc-300 with an underline on hover; no border.
- **States:** pressed sinks 1px; disabled is 50% opacity with a not-allowed cursor; focus-visible is a 2px Signal Blue outline offset 2px.

### Inputs / Fields

The note textarea: Well background, 1px Edge border, mono 15px Ink Bright text, six rows, resizable vertically. Focus switches the border to Signal Blue and adds the glow. Invalid switches the border to Danger Red with the error message beneath in red-300. A slim progress bar and a mono `n / 1000` count sit below; both turn red over the limit.

### Cards / Containers (`.bezel`)

Panel background, 1px Etch Strong border, no radius, no shadow. The result card puts the passenger name in Headline style in a header band ruled with Etch; fields sit in a ruled two-column grid; the verify reminder and usage line follow in dim 12px text.

### Chips

Mono 12px caps with 0.14em tracking, 1px border, 2px 8px padding, square. Mobility aids and the "efficient" rating use the accent border and text; Missing fields and the "problematic" rating use amber.

### Navigation

A sticky top bar with the RideNote name in accent caps at 1.5rem, tracking 0.12em; links in caps at 15px, Ink-dim at rest, accent on hover and when current (a 1px accent underline plus `aria-current`). Links are 44px tall. On a phone, a Menu key opens the list in place; Escape closes it and returns focus. Docs adds a second row of section links divided by a 1px rule.

### Result readout (signature)

The trip card is the product: every field either shows a mono value or the dashed "Not stated" slot; a mobility field with no aid adds a quiet amber "confirm" line rather than a chip, because most notes name no aid and a warning on every card would be ignored.

## Do's and Don'ts

### Do:

- **Do** keep every corner square and every panel flat.
- **Do** use `Edge` (`#63758b`) for any border that identifies an input or an empty slot.
- **Do** show absence as the dashed "Not stated" slot.
- **Do** use the accent for action, selection and identified aids only.
- **Do** keep all controls at least 44px tall and give them a 2px accent focus outline.
- **Do** wrap decorative motion in `motion-safe:`; the loading skeleton is the model.

### Don't:

- **Don't** use rounded corners, pills or white card surfaces; that is the retired earlier design.
- **Don't** put a light/dark class pair on an element; the app is dark-only, so use the dark value directly.
- **Don't** use `Etch` or `Etch Strong` for a border a person needs to see.
- **Don't** colour a Missing field in the accent, or style a blank like a value.
- **Don't** add shadows to panels; only keys have them.
- **Don't** use the mono face for reading paragraphs.
- **Don't** hard-code a colour in a component; add or reuse a token in `app/globals.css`.
