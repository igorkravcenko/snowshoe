# @igorkravcenko/snoe

Thin PATH alias for [Snowshoe](https://github.com/igorkravcenko/snowshoe).
The real CLI lives in `@igorkravcenko/snowshoe`; this package only exposes the `snoe` binary.

```bash
bun add -g @igorkravcenko/snoe
# or: npm install -g @igorkravcenko/snoe
```

Requires [Bun](https://bun.sh) `>=1.1`. Prefer installing `@igorkravcenko/snowshoe` if you want both `snowshoe` and `snoe` on PATH.

Bare unscoped `snoe` is not publishable on npm (name similarity rejection).
