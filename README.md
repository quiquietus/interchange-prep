# Interchange

Interview prep as connected modules. Subjects are lines, topics are stations, projects are interchanges that link back to the stations they use.

- `content/curriculum.json`: every line, station and project, in learning order.
- `content/modules/<station-id>.md`: one station. A station with no file shows as planned.
- `content/projects/<project-id>.md`: one project. `[[station-id]]` links are collected automatically into each station's "Where projects use this" list.
- `node build.js`: renders markdown, runs every `js run` code block on Node and embeds the real output, writes the static site to `dist/`.

Markdown extras: `[[id]]` station link, `!!! key|trap|twist|model|why` ... `!!!` callouts, `?? question` ... `??` answer toggles, fenced `js run`, `output` and `mermaid` blocks.
