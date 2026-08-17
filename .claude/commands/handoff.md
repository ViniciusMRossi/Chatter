---
description: Write session handoff notes and (if a feature just shipped) a devlog entry
---
Run this in the project root:

```
scripts/handoff.sh --reason manual [--ticket <id> --summary "<short summary>" --feature-complete]
```

Fill in `--ticket`, `--summary`, and `--feature-complete` if a ticket was completed this session.
Otherwise just run with `--reason manual`. After running, briefly tell the user what was recorded
in `Docs/handoff.md` (and `Docs/Dev-log.md` if a feature completed).
