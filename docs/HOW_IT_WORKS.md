## How it works

This is a one-page plain-words guide to the Halvard Project Intelligence System demo, written for a managing director reading on a phone. Nothing here is code. Every figure the system shows is synthetic, generated once by a seeded script, and no real project, company or person is represented anywhere.

## What the register is

The market register is one list of every construction project the demo knows about, 3,500 of them, across the UAE. Each project carries where it is, what it is, how far along it is, how much it is worth, and which consultants, contractors and developers are on it. Sitting beside the register is a relevance matrix: a table of about 80 rows, one for every combination of sector, industry and project type the register uses, with a rating against each of Halvard's ten verticals. That matrix is the demo's only opinion about what matters; everything else follows from it.

## How a project gets its ten scores

Every project's type sits on one row of the relevance matrix, and that row already carries a rating against all ten verticals: High, Medium, Low, or nothing at all. A project takes those ten ratings as its own ten scores, converted to numbers so they can be compared and totalled: High is worth 8, Medium is worth 5, Low is worth 2. About one project in twelve gets one to three of its scores nudged up or down by hand, so the numbers are not just the same three values repeated across thousands of rows. A project's overall relevance is simply the highest of its ten scores, so a project that matters to even one vertical is never marked as low priority overall.

## How an owner is chosen

Every project either belongs to exactly one Halvard engineer, on exactly one vertical, or it belongs to nobody yet. The system decides this in five steps, run in order, every time.

1. **Which verticals even qualify.** A vertical only stays in the running if its score on this project is 4.0 or higher. Anything scored lower is treated as not relevant enough to bother with.
2. **Which verticals can act right now.** This depends on how early the project is. A project still being designed only makes sense for verticals that sell by getting specified into the design. A project at tender, or only just starting construction, only makes sense for verticals that sell by winning the buying decision. A project well into construction, or finished, is only still in play if a contractor has already been appointed on it.
3. **Highest score wins.** Among the verticals still standing after steps one and two, whichever one rated this project highest gets it. If two verticals are tied, the one with fewer projects already on its books gets the nod, so work does not pile up unevenly.
4. **Which engineer, inside that vertical.** The project goes to whichever engineer on the winning vertical currently has the smallest pipeline of project value, so books fill up evenly over time.
5. **Sometimes nobody qualifies.** If no vertical clears the first two steps, the project has no owner. It still sits in the register and can still be searched and filtered; it simply is not anyone's responsibility yet.

Every project remembers which of these steps decided its fate, so anyone can ask "why does this project belong to this person" and get a real answer rather than a guess.

## The eleven activity buckets

For every project and every vertical that could sell into it, the system tracks exactly one activity state out of eleven, ranked from most advanced to least: an order has been received, a quote has been sent, an enquiry has been raised, the company profile has been shared, the project has been closed off, a visit has been done, someone has reached out, it is waiting on a reply, there has been no response, no contractor or consultant has been awarded yet, or there has simply been no update. Only one of these applies at a time, and it is always the highest-ranked one that is actually true. A project that has both had an enquiry raised and gone quiet afterward shows the enquiry, not the silence, because the enquiry is the more advanced fact. The state leans toward the more active buckets when a project scores well and is already owned, and drifts toward "no update" the less relevant and the less owned a project is, which is simply a mirror of how a sales desk's attention naturally flows toward the projects that are worth it.

## What each page answers

- **Overview.** How big is the register, how much of it is owned, and how much is that pipeline worth. It shows where the value sits by sector and by stage, which vertical owns what, the twenty projects most worth chasing right now, and how far every project's activity has actually gone.
- **Relevance matrix.** For any type of project, which of the ten verticals should even care, and how much. Shown as a colour-coded grid that can be clicked straight through to the matching projects.
- **Projects.** The full register, searchable and filterable by almost anything, sortable by any column, with the matching count and value always visible, and an export to a spreadsheet.
- **One project's page.** Everything about a single project: who is involved, what it scored on every vertical, who owns it and exactly why, and how far each vertical's relationship with it has gone.
- **Engineers.** Every engineer's book of owned projects, grouped by vertical, with their pipeline value and how far their projects have progressed; clicking through to one engineer shows their full project list and every consultant and contractor they hold a relationship with.
- **Consultants and contractors.** Pick any firm and see who at Halvard owns that relationship, how strong it is, which projects it sits on, and which other firms keep turning up on the same projects.
- **Data basis.** The page that explains everything above in the system's own words: the scoring scale, the five ownership steps, the eleven activity states, how figures are rounded, what was assumed when the data was built, and the machine's own check that every number it shows actually adds up.

## The last word

Every project, every party, every score and every activity state in this system is generated by a seeded script for demonstration purposes only. Nothing in it describes a real project, a real company or a real person. Before any of it is shown, the machine checks its own arithmetic against itself, thousands of times over, and only ships the numbers that pass.
