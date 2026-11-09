"""Interpret the Event-B events of M1_Baseline / M1_Hardened on the three-device
instance (C2_Instance) and explore the state space, to confirm the Event-B
transcription has exactly the model checker's state space.

Usage: python3 eventb/tools/interpret_eventb.py
"""
import os, sys, re, tempfile, importlib.util
from collections import deque
sys.argv = ['x', tempfile.mkdtemp()]   # generator writes a throwaway copy here
spec=importlib.util.spec_from_file_location('gen', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generate_rodin_project.py')); gen=importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
PLACES=gen.PLACES
CONST={'MAXATT':3,'STH':2,'VTH':2,'VMAX':2}
DEV=['GW1','TH1','PLC1']; EXPOSED={'GW1'}; CRITICAL={'PLC1'}
cls={'GW1':'gateway','TH1':'thermostat','PLC1':'plc'}; zone={'GW1':'building','TH1':'building','PLC1':'plant'}
hard={'GW1':0,'TH1':1,'PLC1':2}; adj={(a,b) for a in('building','plant') for b in ('building','plant')}
strength={('gateway','gateway'):2,('gateway','thermostat'):0,('gateway','plc'):1,('thermostat','gateway'):2,('thermostat','thermostat'):1,('thermostat','plc'):0,('plc','gateway'):1,('plc','thermostat'):0,('plc','plc'):1}
ENUMS=set(PLACES)|{'unknown','authenticated','quarantined','none','suspected','confirmed'}
VARS=['place','trust','threat','att','obs','vol']
def tr(e):
    e=e.replace('zone(s) ↦ zone(d) ∈ adj','(zone[s],zone[d]) in adj')
    e=e.replace('strength(cls(d) ↦ cls(s))','strength[(cls[d],cls[s])]')
    e=re.sub(r'\bhard\((\w)\)',r'hard[\1]',e)
    e=re.sub(r'min\(\{(.+?), (\w+)\}\)',r'min(\1, \2)',e)
    e=re.sub(r'∈ \{([\w,]+)\}',lambda m:'in ('+','.join(repr(x) for x in m.group(1).split(','))+',)',e)
    e=re.sub(r'∉ \{([\w,]+)\}',lambda m:'not in ('+','.join(repr(x) for x in m.group(1).split(','))+',)',e)
    e=e.replace('∈ DEV','in DEV').replace('∈ EXPOSED','in EXPOSED').replace('∈ detected','in S["detected"]')
    e=e.replace('∧',' and ').replace('∨',' or ').replace('≠','!=').replace('≥','>=').replace('≤','<=')
    e=re.sub(r'(?<![<>!=])=(?!=)','==',e)
    for v in VARS: e=re.sub(r'\b%s\((\w)\)'%v,r'S["%s"][\1]'%v,e)
    for k,v in CONST.items(): e=re.sub(r'\b%s\b'%k,str(v),e)
    for en in ENUMS: e=re.sub(r'(?<![\'"\w])%s(?![\'"\w(])'%en,repr(en),e)
    return e
def compile_event(ev):
    g=[tr(p) for _,p in ev['guards']]; acts=[]
    for _,a in ev['actions']:
        lhs,rhs=[x.strip() for x in a.split('≔')]
        if lhs=='detected':
            r=rhs.replace('detected ∪ {d}','S["detected"]|{d}').replace('detected ∖ {d}','S["detected"]-{d}')
            acts.append(('detected',None,r))
        else:
            m=re.match(r'(\w+)\((\w)\)',lhs); acts.append((m.group(1),m.group(2),tr(rhs)))
    return ev['label'],ev['params'],g,acts
def explore(mach):
    evs=[compile_event(e) for e in mach['events'] if e['label']!='INITIALISATION']
    init={v:{d:(0 if v in('att','obs','vol') else {'place':'idle','trust':'unknown','threat':'none'}[v]) for d in DEV} for v in VARS}
    init['detected']=frozenset()
    def key(S): return tuple(tuple(S[v][d] for v in VARS)+(d in S['detected'],) for d in DEV)
    seen={key(init):init}; q=deque([init]); edges=0; exfil=0
    while q:
        S=q.popleft()
        for lbl,params,guards,acts in evs:
            binds=[{'d':d} for d in DEV] if params==['d'] else [{'s':s,'d':d} for s in DEV for d in DEV]
            for b in binds:
                env=dict(S=S,DEV=DEV,EXPOSED=EXPOSED,zone=zone,cls=cls,hard=hard,adj=adj,strength=strength,**b)
                if all(eval(gx,{},env) for gx in guards):
                    vals=[(v,idx,eval(r,{},env)) for v,idx,r in acts]   # simultaneous assignment
                    N={v:dict(S[v]) for v in VARS}; N['detected']=S['detected']
                    for v,idx,val in vals:
                        if v=='detected': N['detected']=frozenset(val)
                        else: N[v][env[idx]]=val
                    edges+=1; k=key(N)
                    if k not in seen: seen[k]=N; q.append(N)
    return len(seen),edges,seen
for m in (gen.M1B,gen.M1H):
    n,e,seen=explore(m)
    vp06=sum(1 for S in seen.values() if any(S['place'][d]=='exfil' and d not in S['detected'] for d in DEV))
    print(m['name'],'states',n,'transitions',e,'VP-06 violating states',vp06)
