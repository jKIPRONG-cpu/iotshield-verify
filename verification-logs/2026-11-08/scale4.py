import sys, time
sys.path.insert(0, sys.argv[1])
from crosscheck_model import Graph, check, Device, VERIFIED_DEVICES
devs = VERIFIED_DEVICES + (Device("SN-1", "sensor", "building", 1, False),)
for hardened in (False, True):
    t = time.time(); g = Graph(devs, hardened)
    print("hardened" if hardened else "baseline", "states", g.n, "transitions", g.edges, "terminal", len(g.terminal), f"explore {time.time()-t:.0f}s", flush=True)
    r = check(g, devs)
    for k in sorted(r):
        if k.startswith("VP-0") and k != "VP-05-per-device":
            p = r[k]; print(" ", k, p["status"], p["violating"], ("fair: %s %s" % (p["fair_status"], p["fair_violating"])) if "fair_status" in p else "", flush=True)
    del g
