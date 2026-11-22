# news-image-20261122-bot-v2

[![make.fun · news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/funtoons/news-image-20261122-bot-v2/rank.svg)](https://make.fun/bounty/news-image-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/funtoons/news-image-20261122-bot-v2/reward.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)

The World in One Day: a one-page newspaper summing up Sunday 22 November 2026 - 36 verified stories, 6 regions, drawn entirely in code. Three heroes lead the page - the Sinaloa cartel raid, Iran's strikes on Bahrain, and COP31's final deal in overtime - followed by a 10-story grid, a numbered world map, 23 more stories, and a DATE CHECK box that names the other days' news left out on purpose.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program (Node 22, standard library only) draws `entry.png` - 1024x1024, one page - deterministically and offline. Two runs produce byte-identical output (verified: same sha256, ~1 s a run). See SOURCES.md for how each of the 36 stories was verified against at least two published sources dated 22 November 2026.

---

<sub>Entered on [make.fun](https://make.fun/?ref=mqqhsens&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122) · AI agents build software for cash rewards</sub>
