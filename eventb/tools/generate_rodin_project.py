"""Generate the Rodin (Event-B) project for IoTShield Verify: XML files + a readable listing.

Usage: python3 eventb/tools/generate_rodin_project.py [output_dir]
(default: eventb/IoTShieldEventB). Standard library only.
"""
import os, sys
from xml.sax.saxutils import quoteattr

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "IoTShieldEventB")
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)

def esc(s): return quoteattr(s)

class Names:
    def __init__(self): self.i = 0
    def __call__(self):
        self.i += 1; return f"_{self.i}"

# --------------------------------------------------------------------------
# Contexts
# --------------------------------------------------------------------------
PLACES = ["idle","packet","auth","normal","suspicious","malware","exfil","detect","verify","isolate","recover"]

contexts = [
  dict(name="C0_Abstract", extends=None,
       comment="Abstract device population and exposure.",
       sets=["DEV","STATUS"],
       constants=["ok","compromised","contained","EXPOSED","CRITICAL"],
       axioms=[
         ("axm1","partition(STATUS,{ok},{compromised},{contained})",False),
         ("axm2","finite(DEV)",False),
         ("axm3","DEV ≠ ∅",False),
         ("axm4","EXPOSED ⊆ DEV",False),
         ("axm5","CRITICAL ⊆ DEV",False),
         ("axm6","EXPOSED ∩ CRITICAL = ∅",False),
       ]),
  dict(name="C1_Lifecycle", extends="C0_Abstract",
       comment="Places, colours and the heterogeneous-interaction relation of the IoTShield net.",
       sets=["PLACE","TRUST","THREAT","CLASS","ZONE"],
       constants=PLACES+["unknown","authenticated","quarantined","none","suspected","confirmed",
                  "OKP","CP","CTP","cls","zone","hard","strength","adj","MAXATT","STH","VTH","VMAX"],
       axioms=[
         ("axm1","partition(PLACE,"+",".join("{%s}"%p for p in PLACES)+")",False),
         ("axm2","partition(TRUST,{unknown},{authenticated},{quarantined})",False),
         ("axm3","partition(THREAT,{none},{suspected},{confirmed})",False),
         ("axm4","OKP = {idle,packet,auth,normal}",False),
         ("axm5","CP = {suspicious,malware,exfil,detect,verify}",False),
         ("axm6","CTP = {isolate,recover}",False),
         ("axm7","cls ∈ DEV → CLASS",False),
         ("axm8","zone ∈ DEV → ZONE",False),
         ("axm9","hard ∈ DEV → 0‥2",False),
         ("axm10","strength ∈ CLASS × CLASS → 0‥2",False),
         ("axm11","adj ⊆ ZONE × ZONE",False),
         ("axm12","∀c,s·c ∈ CRITICAL ∧ s ∈ DEV ⇒ strength(cls(c) ↦ cls(s)) ≤ hard(c)",False),
         ("axm13","MAXATT = 3",False),
         ("axm14","STH = 2",False),
         ("axm15","VTH = 2",False),
         ("axm16","VMAX = 2",False),
       ]),
  dict(name="C2_Instance", extends="C1_Lifecycle",
       comment="The three-device configuration verified by the IoTShield model checker (for ProB).",
       sets=[],
       constants=["GW1","TH1","PLC1","gateway","thermostat","plc","building","plant"],
       axioms=[
         ("axm1","partition(DEV,{GW1},{TH1},{PLC1})",False),
         ("axm2","partition(CLASS,{gateway},{thermostat},{plc})",False),
         ("axm3","partition(ZONE,{building},{plant})",False),
         ("axm4","EXPOSED = {GW1}",False),
         ("axm5","CRITICAL = {PLC1}",False),
         ("axm6","cls = {GW1 ↦ gateway, TH1 ↦ thermostat, PLC1 ↦ plc}",False),
         ("axm7","zone = {GW1 ↦ building, TH1 ↦ building, PLC1 ↦ plant}",False),
         ("axm8","hard = {GW1 ↦ 0, TH1 ↦ 1, PLC1 ↦ 2}",False),
         ("axm9","adj = ZONE × ZONE",False),
         ("axm10","strength = {(gateway ↦ gateway) ↦ 2, (gateway ↦ thermostat) ↦ 0, (gateway ↦ plc) ↦ 1, "
                  "(thermostat ↦ gateway) ↦ 2, (thermostat ↦ thermostat) ↦ 1, (thermostat ↦ plc) ↦ 0, "
                  "(plc ↦ gateway) ↦ 1, (plc ↦ thermostat) ↦ 0, (plc ↦ plc) ↦ 1}",False),
       ]),
]

# --------------------------------------------------------------------------
# Machines
# --------------------------------------------------------------------------
def ev(label, params=(), guards=(), actions=(), refines=None, comment=None):
    return dict(label=label, params=list(params), guards=list(guards), actions=list(actions),
                refines=refines, comment=comment, extended=False)

M0 = dict(name="M0_Abstract", refines=None, sees="C0_Abstract",
  comment="Abstract lifecycle: a device is ok, compromised or contained.",
  variables=["status"],
  invariants=[
    ("inv1","status ∈ DEV → STATUS",False),
    ("inv2_vp07","∀c·c ∈ CRITICAL ⇒ status(c) = ok",False),
  ],
  events=[
    ev("INITIALISATION", actions=[("act1","status ≔ DEV × {ok}")]),
    ev("compromise_external", ["d"],
       [("grd1","d ∈ EXPOSED"),("grd2","status(d) = ok")],
       [("act1","status(d) ≔ compromised")],
       comment="An externally exposed device is compromised directly."),
    ev("compromise_lateral", ["s","d"],
       [("grd1","s ∈ DEV"),("grd2","d ∈ DEV"),("grd3","s ≠ d"),
        ("grd4","status(s) = compromised"),("grd5","status(d) = ok"),("grd6","d ∉ CRITICAL")],
       [("act1","status(d) ≔ compromised")],
       comment="Only a compromised, uncontained device can spread; critical assets cannot be reached."),
    ev("contain", ["d"],
       [("grd1","d ∈ DEV"),("grd2","status(d) = compromised")],
       [("act1","status(d) ≔ contained")]),
    ev("release", ["d"],
       [("grd1","d ∈ DEV"),("grd2","status(d) = contained")],
       [("act1","status(d) ≔ ok")]),
  ])

def concrete(name, hardened):
    att_guard = [("grd3","att(d) < MAXATT")] if hardened else []
    reobs_att = "att(d) ≔ att(d) + 1" if hardened else "att(d) ≔ min({att(d) + 1, MAXATT})"
    defer_att = "att(d) ≔ att(d) + 1" if hardened else "att(d) ≔ min({att(d) + 1, MAXATT})"
    egress = [("grd4","d ∈ detected ∨ obs(d) = 0")] if hardened else []
    trig = "obs(d) ≥ STH ∨ att(d) ≥ MAXATT ∨ vol(d) ≥ VTH" if hardened else "obs(d) ≥ STH"
    reset = [("act1","place(d) ≔ idle"),("act2","trust(d) ≔ unknown"),("act3","threat(d) ≔ none"),
             ("act4","att(d) ≔ 0"),("act5","obs(d) ≔ 0"),("act6","vol(d) ≔ 0"),
             ("act7","detected ≔ detected ∖ {d}")]
    dlf_malware = ("att(x) < MAXATT ∨ obs(x) ≥ STH ∨ att(x) ≥ MAXATT ∨ vol(x) ≥ VTH") if hardened else "⊤"
    m = dict(name=name, refines="M0_Abstract", sees="C1_Lifecycle",
      comment=("Concrete IoTShield net, HARDENED variant (bounded retry, dual-indicator detector, egress hold)."
               if hardened else
               "Concrete IoTShield net, BASELINE variant. The VP-06 invariant is expected NOT to be provable here."),
      variables=["place","trust","threat","att","obs","vol","detected"],
      invariants=[
        ("typ1","place ∈ DEV → PLACE",False),
        ("typ2","trust ∈ DEV → TRUST",False),
        ("typ3","threat ∈ DEV → THREAT",False),
        ("typ4","att ∈ DEV → 0‥MAXATT",False),
        ("typ5","obs ∈ DEV → 0‥STH",False),
        ("typ6","vol ∈ DEV → 0‥VMAX",False),
        ("typ7","detected ⊆ DEV",False),
        ("glue1","∀x·x ∈ DEV ⇒ (status(x) = ok ⇔ place(x) ∈ OKP)",False),
        ("glue2","∀x·x ∈ DEV ⇒ (status(x) = compromised ⇔ place(x) ∈ CP)",False),
        ("glue3","∀x·x ∈ DEV ⇒ (status(x) = contained ⇔ place(x) ∈ CTP)",False),
        ("inv1","∀x·x ∈ DEV ⇒ (trust(x) = unknown ⇔ place(x) ∈ {idle,packet})",False),
        ("inv2","∀x·x ∈ DEV ⇒ (trust(x) = quarantined ⇔ place(x) ∈ {isolate,recover})",False),
        ("inv3","∀x·x ∈ DEV ⇒ (threat(x) = none ⇔ place(x) ∈ OKP)",False),
        ("inv4","∀x·x ∈ DEV ∧ threat(x) = suspected ⇒ place(x) = suspicious",False),
        ("inv5","∀x·x ∈ DEV ∧ place(x) ∈ {malware,exfil,detect,verify,isolate,recover} ⇒ threat(x) = confirmed",False),
        ("inv6","∀x·x ∈ DEV ∧ place(x) ∈ {suspicious,malware,exfil} ⇒ obs(x) ≥ 1",False),
        ("inv7","∀x·x ∈ DEV ⇒ (x ∈ detected ⇔ place(x) ∈ {detect,verify,isolate,recover})",False),
        ("vp01","∀x·x ∈ DEV ∧ place(x) = malware ⇒ trust(x) ≠ unknown",True),
        ("vp04","∀x·x ∈ DEV ∧ trust(x) = quarantined ⇒ place(x) ∉ {malware,exfil}",True),
        ("vp06","∀x·x ∈ DEV ∧ place(x) = exfil ⇒ x ∈ detected",False),
        ("vp07","∀c·c ∈ CRITICAL ⇒ threat(c) = none",True),
        ("dlf","∀x·x ∈ DEV ⇒ (place(x) ∈ {idle,auth,suspicious,exfil,detect,verify,isolate,recover,normal}"
               " ∨ (place(x) = packet ∧ trust(x) ≠ quarantined)"
               " ∨ (place(x) = malware ∧ (" + dlf_malware + ")))",True),
      ],
      events=[
        ev("INITIALISATION", actions=[
            ("act1","place ≔ DEV × {idle}"),("act2","trust ≔ DEV × {unknown}"),("act3","threat ≔ DEV × {none}"),
            ("act4","att ≔ DEV × {0}"),("act5","obs ≔ DEV × {0}"),("act6","vol ≔ DEV × {0}"),("act7","detected ≔ ∅")]),
        ev("Receive",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = idle")],[("act1","place(d) ≔ packet")],
           comment="CPN t-receive"),
        ev("Authenticate",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = packet"),("grd3","trust(d) ≠ quarantined")],
           [("act1","place(d) ≔ auth"),("act2","trust(d) ≔ authenticated")], comment="CPN t-auth"),
        ev("AnalyseNormal",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = auth")],[("act1","place(d) ≔ normal")],
           comment="CPN t-analyse, benign outcome"),
        ev("AnalyseSuspicious",["d"],[("grd1","d ∈ EXPOSED"),("grd2","place(d) = auth")],
           [("act1","place(d) ≔ suspicious"),("act2","threat(d) ≔ suspected"),
            ("act3","obs(d) ≔ min({obs(d) + 1, STH})"),("act4","vol(d) ≔ min({vol(d) + 1, VMAX})")],
           refines="compromise_external", comment="CPN t-analyse, suspicious outcome (exposed devices only)"),
        ev("ReObserve",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = suspicious")]+att_guard,
           [("act1","obs(d) ≔ min({obs(d) + 1, STH})"),("act2",reobs_att)], comment="CPN t-reobserve"),
        ev("ExecutePayload",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = suspicious")],
           [("act1","place(d) ≔ malware"),("act2","threat(d) ≔ confirmed")], comment="CPN t-execute"),
        ev("DeferContainment",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = malware")]+att_guard,
           [("act1","place(d) ≔ suspicious"),("act2",defer_att)], comment="CPN t-defer (the containment defect)"),
        ev("Exfiltrate",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = malware"),("grd3","trust(d) ≠ quarantined")]+egress,
           [("act1","place(d) ≔ exfil"),("act2","vol(d) ≔ min({vol(d) + 1, VMAX})")], comment="CPN t-exfil"),
        ev("ResumeExecution",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = exfil")],[("act1","place(d) ≔ malware")],
           comment="CPN t-resume"),
        ev("DetectMalware",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) ∈ {suspicious,malware,exfil}"),("grd3",trig)],
           [("act1","place(d) ≔ detect"),("act2","threat(d) ≔ confirmed"),("act3","detected ≔ detected ∪ {d}")],
           comment="CPN t-detect"),
        ev("VerifyProperties",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = detect")],[("act1","place(d) ≔ verify")],
           comment="CPN t-verify"),
        ev("IsolateDevice",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = verify")],
           [("act1","place(d) ≔ isolate"),("act2","trust(d) ≔ quarantined")], refines="contain",
           comment="CPN t-isolate"),
        ev("RecoverDevice",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = isolate")],[("act1","place(d) ≔ recover")],
           comment="CPN t-recover"),
        ev("RestoreNormal",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = normal")],reset,
           comment="CPN t-restore from Normal Behaviour"),
        ev("RestoreRecovered",["d"],[("grd1","d ∈ DEV"),("grd2","place(d) = recover")],reset,
           refines="release", comment="CPN t-restore from Recovery"),
        ev("LateralInfect",["s","d"],[
            ("grd1","s ∈ DEV"),("grd2","d ∈ DEV"),("grd3","s ≠ d"),
            ("grd4","threat(s) = confirmed"),("grd5","trust(s) ≠ quarantined"),
            ("grd6","threat(d) = none"),("grd7","trust(d) = authenticated"),
            ("grd8","zone(s) ↦ zone(d) ∈ adj"),("grd9","strength(cls(d) ↦ cls(s)) > hard(d)")],
           [("act1","place(d) ≔ suspicious"),("act2","threat(d) ≔ suspected"),
            ("act3","obs(d) ≔ min({obs(d) + 1, STH})"),("act4","vol(d) ≔ min({vol(d) + 1, VMAX})")],
           refines="compromise_lateral", comment="CPN t-infect: two-token binding over class, zone and hardening"),
      ])
    return m

M1H = concrete("M1_Hardened", True)
M1B = concrete("M1_Baseline", False)

def instance(name, abstract):
    evs = []
    for e in abstract["events"]:
        x = dict(label=e["label"], params=[], guards=[], actions=[], refines=e["label"],
                 comment=None, extended=True)
        evs.append(x)
    return dict(name=name, refines=abstract["name"], sees="C2_Instance",
                comment=f"Exact three-device instance of {abstract['name']}, for ProB model checking. Adds nothing.",
                variables=abstract["variables"], invariants=[], events=evs)

M2H = instance("M2_HardenedInstance", M1H)
M2B = instance("M2_BaselineInstance", M1B)
machines = [M0, M1B, M1H, M2B, M2H]

# --------------------------------------------------------------------------
# XML writers
# --------------------------------------------------------------------------
HDR = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'

def write_context(c):
    n = Names()
    L = [HDR + '<org.eventb.core.contextFile org.eventb.core.configuration="org.eventb.core.fwd" '
         + (f'org.eventb.core.comment={esc(c["comment"])} ' if c.get("comment") else '') + 'version="3">']
    if c["extends"]:
        L.append(f'<org.eventb.core.extendsContext name="{n()}" org.eventb.core.target={esc(c["extends"])}/>')
    for s in c["sets"]:
        L.append(f'<org.eventb.core.carrierSet name="{n()}" org.eventb.core.identifier={esc(s)}/>')
    for k in c["constants"]:
        L.append(f'<org.eventb.core.constant name="{n()}" org.eventb.core.identifier={esc(k)}/>')
    for lbl, pred, thm in c["axioms"]:
        L.append(f'<org.eventb.core.axiom name="{n()}" org.eventb.core.label={esc(lbl)} '
                 f'org.eventb.core.predicate={esc(pred)} org.eventb.core.theorem="{"true" if thm else "false"}"/>')
    L.append('</org.eventb.core.contextFile>\n')
    open(os.path.join(OUT, c["name"] + ".buc"), "w", encoding="utf-8").write("\n".join(L))

def write_machine(m):
    n = Names()
    L = [HDR + '<org.eventb.core.machineFile org.eventb.core.configuration="org.eventb.core.fwd" '
         + (f'org.eventb.core.comment={esc(m["comment"])} ' if m.get("comment") else '') + 'version="5">']
    if m["refines"]:
        L.append(f'<org.eventb.core.refinesMachine name="{n()}" org.eventb.core.target={esc(m["refines"])}/>')
    L.append(f'<org.eventb.core.seesContext name="{n()}" org.eventb.core.target={esc(m["sees"])}/>')
    for v in m["variables"]:
        L.append(f'<org.eventb.core.variable name="{n()}" org.eventb.core.identifier={esc(v)}/>')
    for lbl, pred, thm in m["invariants"]:
        L.append(f'<org.eventb.core.invariant name="{n()}" org.eventb.core.label={esc(lbl)} '
                 f'org.eventb.core.predicate={esc(pred)} org.eventb.core.theorem="{"true" if thm else "false"}"/>')
    for e in m["events"]:
        attrs = (f'name="{n()}" org.eventb.core.convergence="0" '
                 f'org.eventb.core.extended="{"true" if e["extended"] else "false"}" '
                 f'org.eventb.core.label={esc(e["label"])}')
        if e.get("comment"):
            attrs += f' org.eventb.core.comment={esc(e["comment"])}'
        L.append(f'<org.eventb.core.event {attrs}>')
        k = Names()
        if e["refines"] and e["label"] != "INITIALISATION":
            L.append(f'  <org.eventb.core.refinesEvent name="{k()}" org.eventb.core.target={esc(e["refines"])}/>')
        for p in e["params"]:
            L.append(f'  <org.eventb.core.parameter name="{k()}" org.eventb.core.identifier={esc(p)}/>')
        for lbl, pred in e["guards"]:
            L.append(f'  <org.eventb.core.guard name="{k()}" org.eventb.core.label={esc(lbl)} '
                     f'org.eventb.core.predicate={esc(pred)}/>')
        for lbl, a in e["actions"]:
            L.append(f'  <org.eventb.core.action name="{k()}" org.eventb.core.assignment={esc(a)} '
                     f'org.eventb.core.label={esc(lbl)}/>')
        L.append('</org.eventb.core.event>')
    L.append('</org.eventb.core.machineFile>\n')
    open(os.path.join(OUT, m["name"] + ".bum"), "w", encoding="utf-8").write("\n".join(L))

for c in contexts: write_context(c)
for m in machines: write_machine(m)

open(os.path.join(OUT, ".project"), "w").write("""<?xml version="1.0" encoding="UTF-8"?>
<projectDescription>
	<name>IoTShieldEventB</name>
	<comment></comment>
	<projects>
	</projects>
	<buildSpec>
		<buildCommand>
			<name>org.rodinp.core.rodinbuilder</name>
			<arguments>
			</arguments>
		</buildCommand>
	</buildSpec>
	<natures>
		<nature>org.rodinp.core.rodinnature</nature>
	</natures>
</projectDescription>
""")

# --------------------------------------------------------------------------
# Readable listing (Camille-like), for the thesis appendix and manual entry
# --------------------------------------------------------------------------
T = []
for c in contexts:
    T.append(f"CONTEXT {c['name']}")
    if c["extends"]: T.append(f"EXTENDS {c['extends']}")
    if c["sets"]: T.append("SETS\n  " + "  ".join(c["sets"]))
    T.append("CONSTANTS\n  " + "  ".join(c["constants"]))
    T.append("AXIOMS")
    for lbl, pred, thm in c["axioms"]:
        T.append(f"  {'theorem ' if thm else ''}@{lbl} {pred}")
    T.append("END\n")
for m in machines:
    T.append(f"MACHINE {m['name']}")
    if m["refines"]: T.append(f"REFINES {m['refines']}")
    T.append(f"SEES {m['sees']}")
    T.append("VARIABLES\n  " + "  ".join(m["variables"]))
    if m["invariants"]:
        T.append("INVARIANTS")
        for lbl, pred, thm in m["invariants"]:
            T.append(f"  {'theorem ' if thm else ''}@{lbl} {pred}")
    T.append("EVENTS")
    for e in m["events"]:
        head = "  " + e["label"]
        if e["extended"]:
            T.append(f"{head} extends {e['refines']}")
            continue
        if e["refines"] and e["label"] != "INITIALISATION":
            head += f" refines {e['refines']}"
        T.append(head + (f"   // {e['comment']}" if e.get("comment") else ""))
        if e["params"]: T.append("    any " + " ".join(e["params"]))
        if e["guards"]:
            T.append("    where")
            for lbl, p in e["guards"]: T.append(f"      @{lbl} {p}")
        T.append("    then")
        for lbl, a in e["actions"]: T.append(f"      @{lbl} {a}")
        T.append("    end")
    T.append("END\n")
open(os.path.join(os.path.dirname(OUT.rstrip("/")), "IoTShield_EventB_listing.txt"), "w", encoding="utf-8").write("\n".join(T))
if __name__ == "__main__":
    print("written", sorted(os.listdir(OUT)))
