---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets:
  ["app/layout.tsx", "components/SideNav.tsx", "components/TripCard.tsx", "components/NoteForm.tsx"]
---

# Surface brief: RideNote app shell and parser

Mode: Operate. Visitor: a reviewer pasting a dispatcher note and judging whether the card can be trusted. Task: paste, parse, read the trip card, spot what is Missing. Applies to the whole app shell (rail, parser, result card, docs pages) as the default look.

Unresolved: no pictogram set (mobility aids are text plates); no logo mark.

## Direction contract

THESIS: The app speaks like accessibility wayfinding signage: calm, high-legibility, one decisive blue. It refuses the zinc-grey dashboard default and the dark "AI tool" look.
OWN-WORLD: Access-blue (#0A4A94) rail with white type; cool blue-grey neutrals (#F3F6FA ground, white cards); Atkinson Hyperlegible Next for text and Atkinson Hyperlegible Mono for times and counts; amber reserved for Missing and the mobility flag, red for errors. Sign plates: square-cornered blue plates carry the passenger name and each mobility aid. Unstated fields are dashed blank slots, never styled as data.
STORY: Visitor sees a plain input, presses Parse, reads a card whose blanks are as visible as its values, and trusts it because nothing is invented.
FIRST VIEWPORT: Left 240px blue rail with the RideNote name and nav. Main column 672px: title and intro, note textarea, solid-blue Parse button with outline Example, then the result card whose header is a blue sign plate holding the passenger name.
FORM: Assigned candidate 7 of my grounded list (access and wayfinding signage), seed:8822b4d8b077afef. The world supplies palette, type, density and the sign-plate move only; navigation and controls stay standard.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
