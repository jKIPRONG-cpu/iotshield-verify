#!/usr/bin/env python3
"""Summarise Rodin proof status (.bps) files.

Rodin writes one .bps file per component, holding one psStatus entry per proof
obligation. A confidence of 1000 means the obligation is discharged; anything
lower means it is not (0 = pending: attempted, not proved). This script only
reads those files. It proves nothing itself.

Usage:
    python3 eventb/tools/rodin_status.py <dir with .bps files> [--open]

--open also lists every obligation that is not discharged.
"""
import collections
import pathlib
import sys
import xml.etree.ElementTree as ET


def attrs(e):
    return {k.split('.')[-1]: v for k, v in e.attrib.items()}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    show_open = '--open' in sys.argv
    folder = pathlib.Path(args[0] if args else '.')
    files = sorted(folder.glob('*.bps'))
    if not files:
        sys.exit(f'no .bps files in {folder}')

    print(f'{"Component":22} {"POs":>5} {"Auto":>5} {"Manual":>6} {"Open":>5}   by kind (discharged/total)')
    total = collections.Counter()
    open_list = []
    for f in files:
        rows = [attrs(e) for e in ET.parse(f).getroot() if e.tag.endswith('psStatus')]
        done = [r for r in rows if r.get('confidence') == '1000']
        manual = sum(r.get('psManual') == 'true' for r in done)
        kinds = collections.Counter(r['name'].split('/')[-1] for r in rows)
        dk = collections.Counter(r['name'].split('/')[-1] for r in done)
        by_kind = ' '.join(f'{k}:{dk[k]}/{n}' for k, n in sorted(kinds.items()))
        print(f'{f.stem:22} {len(rows):5} {len(done) - manual:5} {manual:6} {len(rows) - len(done):5}   {by_kind}')
        total.update(pos=len(rows), auto=len(done) - manual, manual=manual, open=len(rows) - len(done))
        open_list += [(f.stem, r['name']) for r in rows if r.get('confidence') != '1000']

    print(f'{"TOTAL":22} {total["pos"]:5} {total["auto"]:5} {total["manual"]:6} {total["open"]:5}')
    if show_open:
        print(f'\nObligations not discharged ({len(open_list)}):')
        for comp, name in open_list:
            print(f'  {comp}: {name}')


if __name__ == '__main__':
    main()
