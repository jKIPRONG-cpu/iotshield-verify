"""Brute-force check that the Event-B invariants of M1_Baseline / M1_Hardened are
inductive and that every step refines M0_Abstract.

Enumerates every two-device state satisfying the invariants (all combinations of
exposure and of whether each device can infect the other), applies every event
of the net (shared with tools/crosscheck_model.py), and checks that the
invariants still hold and that each status change matches an abstract event.

Usage: python3 eventb/tools/check_invariants.py   (about 1 minute)
"""
import os, sys, itertools
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
from crosscheck_model import successors, Device, P,TR,TH,ATT,OBS,VOL,DET
PL=['idle','packet','auth','normal','suspicious','malware','exfil','detect','verify','isolate','recover']
OKP={'idle','packet','auth','normal'}; CP={'suspicious','malware','exfil','detect','verify'}; CTP={'isolate','recover'}
def status(d): return 'ok' if d[P] in OKP else 'comp' if d[P] in CP else 'cont'
def local_inv(d, hardened, crit):
    p,tr,th,att,obs,vol,det=d
    ok = ((tr=='unknown')==(p in('idle','packet')) and (tr=='quarantined')==(p in('isolate','recover'))
      and (th=='none')==(p in OKP)
      and (th!='confirmed' or p in ('suspicious','malware','exfil','detect','verify','isolate','recover'))
      and (p not in('malware','exfil','detect','verify','isolate','recover') or th=='confirmed')
      and (th!='suspected' or p=='suspicious')
      and (p not in('suspicious','malware','exfil') or obs>=1)
      and det==(p in('detect','verify','isolate','recover')))
    if hardened: ok = ok and (p!='exfil' or det)        # VP-06
    if crit: ok = ok and th=='none'                      # VP-07 generalised
    return ok
ALL=[(p,tr,th,a,o,v,dt) for p in PL for tr in('unknown','authenticated','quarantined') for th in('none','suspected','confirmed')
     for a in range(4) for o in range(3) for v in range(3) for dt in(False,True)]
def check(hardened):
    viol=0; refviol=0; n=0
    for ex0,ex1,h0,h1 in itertools.product([True,False],[True,False],[0,2],[0,2]):
        devs=(Device('A','gateway','building',h0,ex0),Device('B','gateway','building',h1,ex1))
        # critical = not exposed and cannot be infected by the other (hard 2)
        crit=[ (not devs[i].exposed) and devs[i].hard==2 for i in range(2)]
        L=[[d for d in ALL if local_inv(d,hardened,crit[i])] for i in range(2)]
        for m in itertools.product(L[0],L[1]):
            n+=1
            for (t,i,j),nm in successors(m,devs,hardened):
                if not all(local_inv(nm[k],hardened,crit[k]) for k in range(2)):
                    viol+=1
                    if viol<4: print('INV BREAK',t,i,j,m,'->',nm)
                # refinement: status changes allowed only per abstract events
                s0=[status(x) for x in m]; s1=[status(x) for x in nm]
                ch=[k for k in range(2) if s0[k]!=s1[k]]
                if not ch: continue
                okref=False
                if len(ch)==1:
                    k=ch[0]
                    if s0[k]=='ok' and s1[k]=='comp':
                        if t=='t-analyse' and devs[k].exposed: okref=True            # compromise_external
                        if t=='t-infect' and j==k and s0[i]=='comp': okref=True       # compromise_lateral(src comp)
                    if s0[k]=='comp' and s1[k]=='cont' and t=='t-isolate': okref=True # contain
                    if s0[k]=='cont' and s1[k]=='ok' and t=='t-restore': okref=True   # release
                if not okref:
                    refviol+=1
                    if refviol<4: print('REF BREAK',t,i,j,m,'->',nm)
    print('hardened' if hardened else 'baseline','pre-states',n,'invariant breaks',viol,'refinement breaks',refviol)
    print('  per-device invariant states:',len([d for d in ALL if local_inv(d,hardened,False)]))
check(True); check(False)
