# Codename Duet Assistant

A phone-friendly key card generator for Codenames Duet, with custom grid sizes and adjustable card settings. Unofficial and fan-made; not affiliated with Czech Games Edition.

## How it works

1. The host picks settings and taps **Generate key card**. Their phone shows one side of the card.
2. The host taps **Show QR code for partner**. The partner scans it with their phone camera.
3. The partner's phone opens the other side of the same card, already rotated for someone sitting opposite.

There is no server. A card is fully determined by its settings and a random seed, and the QR code carries both in the link (`/#j=<code>`). This means the link technically contains both sides; the app simply never offers a way to flip.

## Settings

| Setting | Standard game |
|---|---|
| Rows × columns (3–8 each) | 5 × 5 |
| Agents per side | 9 |
| Assassins per side | 3 |
| Shared agents (green on both sides) | 3 |
| Assassin hiding an agent (black on one side, green on the other) | 1 |
| Double assassins (black on both sides) | 1 |

Changing the grid size loads recommended counts scaled from the standard ratios.

## Project layout

- `public/` — the whole site; this folder is what gets deployed
  - `keycard.js` — card generation and share codes (no DOM, covered by tests)
  - `app.js`, `index.html`, `styles.css` — the interface
  - `sw.js`, `manifest.webmanifest`, `icons/` — offline support and home-screen install
  - `vendor/qrcode.js` — [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT)
- `tests/` — unit tests for the generator
- `tools/make_icons.py` — regenerates the icons

## Development

Requires Node 20+ for tests and Python 3 for the local server. There is no build step and no dependencies to install.

```sh
npm test        # run the generator tests
npm run serve   # serve the site at http://localhost:8000
```

To try the join flow on a real phone, the phone must be able to reach the site over HTTPS (or use the deployed site); QR links point at whatever address the host has open.

## Deployment

The site is live at https://duetkeycard.com, served as static files by Caddy on a Linode (Ubuntu 24.04).

To publish changes, run the tests and copy `public/` to the server with:

```sh
./deploy/deploy.sh
```

The script reads the destination from `deploy/target` (ignored by git) or the `DEPLOY_TARGET` environment variable, in rsync form such as `user@your-server:/var/www/duetkeycard/`.

- `deploy/Caddyfile` is the server's Caddy config (`/etc/caddy/Caddyfile`). After editing it, copy it to the server and run `sudo systemctl reload caddy`.
- The site lives in `/var/www/duetkeycard` on the server. Root and password logins over SSH are disabled.

If you add or rename files under `public/`, update the `ASSETS` list and bump `CACHE` in `public/sw.js` so offline copies stay complete.

## License

[MIT](LICENSE). The bundled QR code library in `public/vendor/` is also MIT licensed and keeps its own copyright notice.
