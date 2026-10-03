# Placeholder: `map-after-pull.png`

**TODO(OWNER):** capture and commit `docs/assets/map-after-pull.png`, then wire it
in the root README (replace the italic placeholder + HTML TODO comment).

## Shot requirements

- Real UI from `snowshoe map serve` (current build — no invented chrome)
- After a pull / freshness delta: several nodes visible
- At least one **stale** / catch-up signal in frame
- Not a chat transcript
- Not an empty all-green tree
- Not an outdoor snowshoe photo or unrelated stock

## Suggested capture

1. Init a scratch repo; seed a small map; mark or refresh so something is stale.
2. `snowshoe map serve --open`
3. Crop the map (tree + stale/catch-up), export PNG here as `map-after-pull.png`
