# Checks

Every one of these exists because something specific went wrong. Run them
all with:

```bash
./checks/run_all.sh
```

It builds the site, serves it on `http://127.0.0.1:8899`, runs the static
checks against the repository and the browser checks against the served
build, and exits non-zero if anything fails.

The browser checks need Playwright's chromium. `run_all.sh` finds it
automatically; override with `CHROME_PATH=/path/to/chrome`. `BASE_URL` points
the browser checks at a different server if you want one.

| Script | What it catches |
|---|---|
| `check_links.py` | Broken links, anchors that point at nothing, JSON-LD that does not parse, duplicate content between pages. |
| `check_faq.py` | The visible FAQ and the `FAQPage` schema saying different things. A reader and a search engine must be told the same answer. |
| `check_doc_structure.py` | A section or block escaping the `.doc` wrapper in the long troubleshooting documents — the browser then re-nests it and the prose loses its width. |
| `check_notes.py` | A reading with nowhere to write its unit line. `setOut()` writes into `[data-note="key"]`; if the page has no such element the line is silently discarded and the reading can only ever show a dash. Also asserts that the starting line the markup declares is one the script can actually write. |
| `check_bylines.py` | The visible byline and the schema dates disagreeing. The published date is the launch date and never moves; the updated date moves only on a substantive content change. |
| `audit_struct.py` | Duplicate ids, broken heading order, missing alt text and labels, title and description length, canonical consistency, sitemap agreement, form wiring, colour contrast. |
| `spell_check.py` | A spelling sweep across the shipped site. It reports a list for a human to judge, not a verdict — proper nouns and British spellings are auto-accepted. |
| `link_map.py` | A link whose anchor text does not say where it goes. A valid href is not the same as a correct one. |
| `browser_audit.js` | The site audit in a real browser: third-party requests, console errors, the review overlay, the skip link, form behaviour. |
| `test_maintenance.js` | Heading order, labels, and the maintenance invariants across every page. |
| `test_notes.js` | Every reading has a visible unit line, the summary tiles fill, the lock lamps and the trackpad chips explain themselves, the bylines are visible. |
| `test_layout.js` | The physical layout detector, through every branch it can take — including an input method that reports no character at all. |
| `test_trackpad.js` | The trackpad panels, driven for real: pointer rate, scroll shape, gestures, the key map, the numpad, the counters. |
| `test_overflow.js` | Horizontal overflow at 360, 390, 430, 768, 1024 and 1280px. |

`browser_audit2.js`, `browser_audit3.js` and `test_tp_shape.js` are earlier
passes kept for reference; `run_all.sh` runs the current set.

## Writing a new check

A check earns its place by naming a defect that actually happened. Every
script here was written the day something broke, and each one still catches
that thing. If a check stops catching it, delete the check rather than
letting it sit there green.

Two rules the scripts follow:

- **Assert the tree, not the eyeball.** A pixel measurement can read "fine"
  for an element that is visibly broken — it measured the wrong element on
  the wrong page. Query the DOM and check the structure.
- **A test that fails because the test is wrong is worse than no test.** It
  invites a fix to working code. When a check fails, read the failure as a
  claim about the site, not about the check.
