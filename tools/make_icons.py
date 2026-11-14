"""Draws the app icons (a small key card) using only the standard library.

Usage: python3 tools/make_icons.py
"""

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

BG = (20, 24, 29)
G = (47, 158, 79)  # agent
K = (10, 10, 10)  # assassin
T = (217, 199, 163)  # bystander
PATTERN = [
    [G, T, T, G],
    [T, K, G, T],
    [G, T, T, K],
    [T, G, T, G],
]


def render(size: int) -> bytes:
    n = len(PATTERN)
    margin = size * 0.18  # keeps the grid inside the maskable safe zone
    step = (size - 2 * margin) / n
    gap = step * 0.12
    rows = []
    for y in range(size):
        row = bytearray([0])  # PNG filter type: none
        for x in range(size):
            color = BG
            cx, cy = (x - margin) / step, (y - margin) / step
            if 0 <= cx < n and 0 <= cy < n:
                fx, fy = (cx % 1) * step, (cy % 1) * step
                if gap / 2 <= fx < step - gap / 2 and gap / 2 <= fy < step - gap / 2:
                    color = PATTERN[int(cy)][int(cx)]
            row.extend(color)
        rows.append(bytes(row))

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
        (OUT / name).write_bytes(render(size))
        print(f"wrote {OUT / name}")
