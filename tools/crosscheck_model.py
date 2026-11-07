#!/usr/bin/env python3
"""
Independent cross-check of the IoTShield Verify model checker.

This script re-implements, in Python and with no shared code, the coloured
Petri net defined in frontend/src/components/petri/formal/ and the property
checks run by tools/verify_model.mjs. It then compares its own results with the
TypeScript checker's published results (frontend/src/data/verification-results.json
or VERIFICATION_EVIDENCE.md).

What "independent" means here
-----------------------------
The net semantics (places, guards, arc effects, bounds, device configuration)
are transcribed from the model definition, because both implementations must
describe the same net. Everything else is written separately:

  * state encoding and breadth-first exploration
  * the CTL fixpoints (EF, EG, AF)
  * the weak-fairness check (Tarjan SCCs + binding-element obligations)

Agreement therefore shows that the TypeScript explorer and fixpoint code
compute what the model definition says. It does not show that the model is a
faithful picture of real malware; that is a separate question.

Usage
-----
    python3 tools/crosscheck_model.py            # human-readable report
    python3 tools/crosscheck_model.py --json     # machine-readable

Standard library only; Python 3.9+.
"""

from __future__ import annotations

import json
import sys
from collections import deque
from dataclasses import dataclass

# --------------------------------------------------------------------------
# Colour sets and parameters (transcribed from formal/colour.ts)
# --------------------------------------------------------------------------

MAX_ANALYSIS_ATTEMPTS = 3
SUSPICION_THRESHOLD = 2
VOLUME_THRESHOLD = 2
VOLUME_BUCKETS = 3

ZONE_ADJ = {
    "perimeter": {"perimeter", "building"},
    "building": {"building", "perimeter", "clinical", "plant"},
    "clinical": {"clinical", "building"},
    "plant": {"plant", "building"},
}

# INFECTION[target][source]: attack strength a compromised `source` brings
# against `target`. Only the class pairs used by the verified configuration
# and the six scenarios are needed, but the full matrix is kept for fidelity.
_CLASSES = ["camera", "gateway", "lock", "sensor", "bulb", "monitor",
            "thermostat", "weather", "plc", "speaker"]
_ROWS = {
    "camera":     [1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    "gateway":    [1, 2, 0, 0, 0, 0, 0, 0, 1, 0],
    "lock":       [0, 2, 0, 2, 0, 0, 0, 0, 0, 0],
    "sensor":     [0, 2, 0, 1, 0, 0, 0, 0, 0, 0],
    "bulb":       [0, 2, 0, 1, 1, 0, 0, 0, 0, 0],
    "monitor":    [0, 1, 0, 1, 0, 1, 0, 0, 0, 0],
    "thermostat": [0, 2, 0, 2, 0, 0, 1, 1, 0, 0],
    "weather":    [0, 1, 0, 1, 0, 0, 0, 1, 0, 0],
    "plc":        [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
    "speaker":    [0, 2, 0, 0, 0, 0, 0, 0, 0, 1],
}
INFECTION = {t: dict(zip(_CLASSES, row)) for t, row in _ROWS.items()}


@dataclass(frozen=True)
class Device:
    id: str
    cls: str
    zone: str
    hard: int
    exposed: bool


VERIFIED_DEVICES = (
    Device("GW-1", "gateway", "building", 0, True),
    Device("TH-1", "thermostat", "building", 1, False),
    Device("PLC-1", "plc", "plant", 2, False),
)

SAFE = {"idle", "normal", "isolate", "recover"}


def clamp(v: int, hi: int) -> int:
    return 0 if v < 0 else hi if v > hi else v


# A device state is a tuple, so markings are hashable without a key function:
# (place, trust, threat, att, obs, vol, detFired)
P, TR, TH, ATT, OBS, VOL, DET = range(7)
INIT_DEV = ("idle", "unknown", "none", 0, 0, 0, False)


def upd(d: tuple, **kw) -> tuple:
    fields = ["place", "trust", "threat", "att", "obs", "vol", "det"]
    lst = list(d)
    for k, v in kw.items():
        lst[fields.index(k)] = v
    return tuple(lst)


# --------------------------------------------------------------------------
# Transition relation (interleaving semantics)
# --------------------------------------------------------------------------

def successors(m: tuple, devs: tuple, hardened: bool):
    """Yield (binding, next_marking). A binding is (transition, i, j|None)."""
    out = []

    def put(binding, i, newd, j=None, newt=None):
        lst = list(m)
        lst[i] = newd
        if j is not None:
            lst[j] = newt
        out.append((binding, tuple(lst)))

    for i, d in enumerate(m):
        prof = devs[i]
        place, trust, threat, att, obs, vol, det = d

        if place == "idle":
            put(("t-receive", i, None), i, upd(d, place="packet"))

        if place == "packet" and trust != "quarantined":
            put(("t-auth", i, None), i, upd(d, place="auth", trust="authenticated"))

        if place == "auth":
            put(("t-analyse", i, None), i, upd(d, place="normal"))
            if prof.exposed:
                put(("t-analyse", i, None), i, upd(
                    d, place="suspicious", threat="suspected",
                    obs=clamp(obs + 1, SUSPICION_THRESHOLD),
                    vol=clamp(vol + 1, VOLUME_BUCKETS - 1)))

        bounded_ok = (not hardened) or att < MAX_ANALYSIS_ATTEMPTS

        if place == "suspicious" and bounded_ok:
            put(("t-reobserve", i, None), i, upd(
                d, obs=clamp(obs + 1, SUSPICION_THRESHOLD),
                att=clamp(att + 1, MAX_ANALYSIS_ATTEMPTS)))

        if place == "suspicious":
            put(("t-execute", i, None), i, upd(d, place="malware", threat="confirmed"))

        if place == "malware" and bounded_ok:
            put(("t-defer", i, None), i, upd(
                d, place="suspicious", att=clamp(att + 1, MAX_ANALYSIS_ATTEMPTS)))

        egress = (not hardened) or det or obs == 0
        if place == "malware" and trust != "quarantined" and egress:
            put(("t-exfil", i, None), i, upd(
                d, place="exfil", vol=clamp(vol + 1, VOLUME_BUCKETS - 1)))

        if place == "exfil":
            put(("t-resume", i, None), i, upd(d, place="malware"))

        trig = obs >= SUSPICION_THRESHOLD
        if hardened:
            trig = trig or att >= MAX_ANALYSIS_ATTEMPTS or vol >= VOLUME_THRESHOLD
        if place in ("suspicious", "malware", "exfil") and trig:
            put(("t-detect", i, None), i, upd(
                d, place="detect", threat="confirmed", det=True))

        if place == "detect":
            put(("t-verify", i, None), i, upd(d, place="verify"))
        if place == "verify":
            put(("t-isolate", i, None), i, upd(d, place="isolate", trust="quarantined"))
        if place == "isolate":
            put(("t-recover", i, None), i, upd(d, place="recover"))
        if place in ("recover", "normal"):
            put(("t-restore", i, None), i, INIT_DEV)

        # Lateral infection: a two-token binding.
        if threat == "confirmed" and trust != "quarantined":
            for j, t in enumerate(m):
                if j == i:
                    continue
                tp = devs[j]
                if t[TH] != "none" or t[TR] != "authenticated":
                    continue
                if tp.zone not in ZONE_ADJ[prof.zone]:
                    continue
                if INFECTION[tp.cls][prof.cls] <= tp.hard:
                    continue
                newt = upd(t, place="suspicious", threat="suspected",
                           obs=clamp(t[OBS] + 1, SUSPICION_THRESHOLD),
                           vol=clamp(t[VOL] + 1, VOLUME_BUCKETS - 1))
                put(("t-infect", i, j), i, d, j, newt)
    return out


# --------------------------------------------------------------------------
# Reachability graph
# --------------------------------------------------------------------------

class Graph:
    def __init__(self, devs: tuple, hardened: bool):
        init = tuple(INIT_DEV for _ in devs)
        self.states = [init]
        index = {init: 0}
        self.succ: list[list[int]] = [[]]
        self.label: list[list[tuple]] = [[]]
        q = deque([0])
        while q:
            s = q.popleft()
            for binding, nm in successors(self.states[s], devs, hardened):
                t = index.get(nm)
                if t is None:
                    t = len(self.states)
                    index[nm] = t
                    self.states.append(nm)
                    self.succ.append([])
                    self.label.append([])
                    q.append(t)
                self.succ[s].append(t)
                self.label[s].append(binding)
        self.n = len(self.states)
        self.edges = sum(len(x) for x in self.succ)
        self.terminal = [i for i in range(self.n) if not self.succ[i]]
        self.pred: list[list[int]] = [[] for _ in range(self.n)]
        for s in range(self.n):
            for t in self.succ[s]:
                self.pred[t].append(s)

    # ---- CTL ------------------------------------------------------------
    def EF(self, p: list[bool]) -> list[bool]:
        r = list(p)
        stack = [i for i, v in enumerate(p) if v]
        while stack:
            s = stack.pop()
            for q in self.pred[s]:
                if not r[q]:
                    r[q] = True
                    stack.append(q)
        return r

    def EG(self, p: list[bool]) -> list[bool]:
        """Greatest fixpoint via counting surviving successors (linear)."""
        r = list(p)
        cnt = [0] * self.n
        for s in range(self.n):
            if r[s]:
                cnt[s] = sum(1 for t in self.succ[s] if r[t])
        work = [s for s in range(self.n) if r[s] and self.succ[s] and cnt[s] == 0]
        while work:
            s = work.pop()
            if not r[s]:
                continue
            r[s] = False
            for q in self.pred[s]:
                if r[q]:
                    cnt[q] -= 1
                    if cnt[q] == 0 and self.succ[q]:
                        work.append(q)
        return r

    def AF(self, p: list[bool]) -> list[bool]:
        eg = self.EG([not v for v in p])
        return [not v for v in eg]

    # ---- Weak fairness --------------------------------------------------
    def _sccs(self, p: list[bool]):
        """Iterative Tarjan over the p-subgraph."""
        idx = [-1] * self.n
        low = [0] * self.n
        on = [False] * self.n
        st: list[int] = []
        c = 0
        for root in range(self.n):
            if not p[root] or idx[root] != -1:
                continue
            work = [(root, 0)]
            idx[root] = low[root] = c
            c += 1
            st.append(root)
            on[root] = True
            while work:
                v, k = work[-1]
                if k < len(self.succ[v]):
                    work[-1] = (v, k + 1)
                    w = self.succ[v][k]
                    if not p[w]:
                        continue
                    if idx[w] == -1:
                        idx[w] = low[w] = c
                        c += 1
                        st.append(w)
                        on[w] = True
                        work.append((w, 0))
                    elif on[w]:
                        low[v] = min(low[v], idx[w])
                else:
                    work.pop()
                    if work:
                        u = work[-1][0]
                        low[u] = min(low[u], low[v])
                    if low[v] == idx[v]:
                        comp = []
                        while True:
                            w = st.pop()
                            on[w] = False
                            comp.append(w)
                            if w == v:
                                break
                        yield comp

    def EG_weakly_fair(self, p: list[bool]) -> list[bool]:
        """States with a weakly fair infinite path that stays inside p.

        A path that visits every state of an SCC infinitely often and takes
        every internal edge is weakly fair iff every binding element that is
        enabled in ALL states of the SCC fires on some internal edge. (A
        binding disabled somewhere is disabled infinitely often on such a
        path, so weak fairness owes it nothing.)
        """
        seed = [False] * self.n
        for comp in self._sccs(p):
            members = set(comp)
            internal_edge = False
            fired = set()
            always = None
            for u in comp:
                en = set(self.label[u])
                always = en if always is None else (always & en)
                for t, b in zip(self.succ[u], self.label[u]):
                    if t in members:
                        internal_edge = True
                        fired.add(b)
            if internal_edge and always <= fired:
                for u in comp:
                    seed[u] = True
        # backward reachability to a fair SCC, staying inside p
        r = list(seed)
        stack = [i for i, v in enumerate(seed) if v]
        while stack:
            s = stack.pop()
            for q in self.pred[s]:
                if p[q] and not r[q]:
                    r[q] = True
                    stack.append(q)
        return r

    def AF_weakly_fair(self, p: list[bool]) -> list[bool]:
        eg = self.EG_weakly_fair([not v for v in p])
        return [not v for v in eg]


# --------------------------------------------------------------------------
# Properties (same formulas as formal/properties.ts)
# --------------------------------------------------------------------------

def can_transmit(d) -> bool:
    return d[TR] != "quarantined" and d[P] in ("malware", "exfil")


def check(g: Graph, devs: tuple) -> dict:
    S = g.states
    plc = next((i for i, d in enumerate(devs) if d.cls == "plc"), None)
    res = {}

    def inv(pid, pred):
        bad = sum(1 for m in S if not pred(m))
        res[pid] = {"status": "Verified" if bad == 0 else "Failed", "violating": bad}

    inv("VP-01", lambda m: all(not (d[P] == "malware" and d[TR] == "unknown") for d in m))
    safe = [all(d[P] in SAFE for d in m) for m in S]
    ef = g.EF(safe)
    bad = sum(1 for v in ef if not v)
    res["VP-02"] = {"status": "Verified" if bad == 0 else "Failed", "violating": bad}
    res["VP-03"] = {"status": "Verified" if not g.terminal else "Failed",
                    "violating": len(g.terminal)}
    inv("VP-04", lambda m: all(not (d[TR] == "quarantined" and can_transmit(d)) for d in m))

    # VP-05 exactly as implemented in properties.ts:
    #   antecedent  = some device in Malware Execution
    #   consequent  = some device in Isolation
    ante = [any(d[P] == "malware" for d in m) for m in S]
    tgt = [any(d[P] == "isolate" for d in m) for m in S]
    af, aff = g.AF(tgt), g.AF_weakly_fair(tgt)
    b1 = sum(1 for a, v in zip(ante, af) if a and not v)
    b2 = sum(1 for a, v in zip(ante, aff) if a and not v)
    res["VP-05"] = {"status": "Verified" if b1 == 0 else "Failed", "violating": b1,
                    "fair_status": "Verified" if b2 == 0 else "Failed",
                    "fair_violating": b2}

    inv("VP-06", lambda m: all(not (d[P] == "exfil" and not d[DET]) for d in m))
    inv("VP-07", lambda m: plc is None or m[plc][TH] != "confirmed")
    inv("VP-08", lambda m: sum(1 for d in m if d[TH] == "confirmed") <= 2)

    # VP-05 per device (the reading in the property's prose): for EVERY
    # device d, d in Malware Execution -> AF (d in Isolation). Reported as an
    # additional check; it is not part of the published property set.
    per = {"status": "Verified", "fair_status": "Verified", "by_device": {}}
    for i, dv in enumerate(devs):
        a = [m[i][P] == "malware" for m in S]
        t = [m[i][P] == "isolate" for m in S]
        x, y = g.AF(t), g.AF_weakly_fair(t)
        v1 = sum(1 for aa, vv in zip(a, x) if aa and not vv)
        v2 = sum(1 for aa, vv in zip(a, y) if aa and not vv)
        reach = any(a)
        per["by_device"][dv.id] = {"reaches_malware": reach,
                                   "violating": v1, "fair_violating": v2}
        if v1:
            per["status"] = "Failed"
        if v2:
            per["fair_status"] = "Failed"
    res["VP-05-per-device"] = per
    return res


# --------------------------------------------------------------------------
# Published results to compare against
# --------------------------------------------------------------------------

EXPECTED = {
    "baseline": {"states": 15876, "transitions": 70400,
                 "VP-05": ("Failed", 5600, "Failed"), "VP-06": ("Failed", 3332, None)},
    "hardened": {"states": 5184, "transitions": 19888,
                 "VP-05": ("Failed", 1596, "Verified"), "VP-06": ("Verified", 0, None)},
}


def main() -> int:
    as_json = "--json" in sys.argv
    report = {}
    mismatches = 0
    for variant in ("baseline", "hardened"):
        g = Graph(VERIFIED_DEVICES, variant == "hardened")
        r = check(g, VERIFIED_DEVICES)
        report[variant] = {"states": g.n, "transitions": g.edges,
                           "terminal": len(g.terminal), "properties": r}
        exp = EXPECTED[variant]
        for k in ("states", "transitions"):
            if report[variant][k] != exp[k]:
                mismatches += 1
        for pid in ("VP-05", "VP-06"):
            st, viol, fair = exp[pid]
            got = r[pid]
            if got["status"] != st or got["violating"] != viol:
                mismatches += 1
            if fair and got.get("fair_status") != fair:
                mismatches += 1
        for pid in ("VP-01", "VP-02", "VP-03", "VP-04", "VP-07", "VP-08"):
            if r[pid]["status"] != "Verified":
                mismatches += 1
    report["mismatches_against_published_results"] = mismatches

    if as_json:
        print(json.dumps(report, indent=2))
        return 0 if mismatches == 0 else 1

    for variant in ("baseline", "hardened"):
        v = report[variant]
        print(f"\n{variant.upper()}: {v['states']:,} states, "
              f"{v['transitions']:,} transitions, {v['terminal']} terminal")
        for pid in ("VP-01", "VP-02", "VP-03", "VP-04", "VP-05", "VP-06", "VP-07", "VP-08"):
            p = v["properties"][pid]
            extra = f"  (weak fairness: {p['fair_status']}, {p['fair_violating']} violating)" \
                if "fair_status" in p else ""
            print(f"  {pid}  {p['status']:<8}  {p['violating']:>5} violating{extra}")
        pd = v["properties"]["VP-05-per-device"]
        print(f"  VP-05 per-device reading: {pd['status']} "
              f"(weak fairness: {pd['fair_status']})")
        for dev, x in pd["by_device"].items():
            print(f"      {dev:<6} reaches Malware Execution: {x['reaches_malware']!s:<5}  "
                  f"violating {x['violating']:>5}  under weak fairness {x['fair_violating']:>5}")
    print(f"\nMismatches against published results: {mismatches}")
    return 0 if mismatches == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
