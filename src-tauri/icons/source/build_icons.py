#!/usr/bin/env python3
"""Regenerate every app icon from the SVG sources in this folder.

Needs macOS (iconutil) and Google Chrome (used as the SVG rasteriser):
    python3 src-tauri/icons/source/build_icons.py

Sources (text already converted to outlines: Nunito Bold, SIL OFL):
  icon-mac.svg / icon-mac-small.svg    Apple grid (824 px body + drop shadow) -> icon.icns, icon.png
  icon-full.svg / icon-full-small.svg  fills the canvas, no shadow            -> icon.ico and the other PNGs
The *-small.svg artwork ("# y") is used up to 40 px, where "# ylin" is no longer legible.
"""
import os
import shutil
import struct
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(ICONS))
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


def render(tmp, variant, size):
    """Rasterise <variant>.svg at exactly size x size pixels."""
    out = os.path.join(tmp, f'{variant}-{size}.png')
    if not os.path.exists(out):
        svg = open(os.path.join(HERE, f'{variant}.svg'), encoding='utf-8').read()
        svg = svg.replace('width="1024" height="1024"', f'width="{size}" height="{size}"', 1)
        src = os.path.join(tmp, f'{variant}-{size}.svg')
        open(src, 'w', encoding='utf-8').write(svg)
        subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                        '--default-background-color=00000000', f'--window-size={size},{size}',
                        f'--screenshot={out}', 'file://' + src],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return out


def pick(tmp, variant, size):
    return render(tmp, variant + '-small' if size <= 40 else variant, size)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        # macOS
        iconset = os.path.join(tmp, 'icon.iconset')
        os.mkdir(iconset)
        for pt in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                name = f'icon_{pt}x{pt}{"@2x" if scale == 2 else ""}.png'
                shutil.copy(pick(tmp, 'icon-mac', pt * scale), os.path.join(iconset, name))
        subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', os.path.join(ICONS, 'icon.icns')], check=True)

        # Windows: .ico with PNG-compressed entries
        sizes = (16, 20, 24, 32, 40, 48, 64, 256)
        blobs = [open(pick(tmp, 'icon-full', s), 'rb').read() for s in sizes]
        ico = struct.pack('<HHH', 0, 1, len(blobs))
        offset = 6 + 16 * len(blobs)
        for s, data in zip(sizes, blobs):
            ico += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(data), offset)
            offset += len(data)
        open(os.path.join(ICONS, 'icon.ico'), 'wb').write(ico + b''.join(blobs))

        # PNGs listed in tauri.conf.json, Windows Store logos, About-panel logo
        pngs = {
            '32x32.png': ('icon-full', 32),
            '128x128.png': ('icon-full', 128),
            '128x128@2x.png': ('icon-full', 256),
            'icon.png': ('icon-mac', 512),  # Dock icon while running `tauri dev` on macOS
            'StoreLogo.png': ('icon-full', 50),
        }
        for s in (30, 44, 71, 89, 107, 142, 150, 284, 310):
            pngs[f'Square{s}x{s}Logo.png'] = ('icon-full', s)
        for name, (variant, s) in pngs.items():
            shutil.copy(pick(tmp, variant, s), os.path.join(ICONS, name))
        shutil.copy(render(tmp, 'icon-full', 256), os.path.join(REPO, 'src', 'assets', 'logo.png'))
    print('Icons written to', ICONS)


if __name__ == '__main__':
    main()
