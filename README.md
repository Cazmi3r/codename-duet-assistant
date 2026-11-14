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

The site is static files. On the server, Caddy serves the folder and handles HTTPS:

```
yourdomain.com {
    root * /var/www/codename-duet-assistant
    file_server
    encode gzip
}
```

Copy the site up with:

```sh
rsync -av --delete public/ user@your-server:/var/www/codename-duet-assistant/
```

When changing any file under `public/`, bump `CACHE` in `public/sw.js` if you add or rename files so offline copies stay complete.
