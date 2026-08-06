"""
PDF report generation with ReportLab.

Builds a branded, multi-section incident assessment as an in-memory PDF. The
document deliberately mirrors the on-screen Incident Reports page section for
section, so the exported artefact and the console tell the same story.

Returns raw bytes beginning with ``%PDF`` — the caller streams them straight
back with ``application/pdf``.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ==========================================================================
# Brand palette
# --------------------------------------------------------------------------
# The console's navy/electric-blue identity, translated for print. Severity
# colours are the reserved status palette and are always paired with the
# severity word, never used alone.
# ==========================================================================

NAVY = colors.HexColor("#0F1A2F")
NAVY_DEEP = colors.HexColor("#080E1A")
BRAND = colors.HexColor("#3B82F6")
ICE = colors.HexColor("#22D3EE")
INK = colors.HexColor("#101828")
INK_MUTED = colors.HexColor("#5A6478")
RULE = colors.HexColor("#D5DAE3")
BAND = colors.HexColor("#F3F6FB")

SEVERITY_COLOR = {
    "Critical": colors.HexColor("#D03B3B"),
    "High": colors.HexColor("#E07A3C"),
    "Medium": colors.HexColor("#C9931A"),
    "Low": colors.HexColor("#2E7CD6"),
}

STATUS_COLOR = {
    "Verified": colors.HexColor("#118A33"),
    "Failed": colors.HexColor("#D03B3B"),
    "Warning": colors.HexColor("#C9931A"),
}

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


# ==========================================================================
# Styles
# ==========================================================================


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()

    return {
        "title": ParagraphStyle(
            "IsTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=25,
            textColor=colors.white,
            alignment=TA_LEFT,
            spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "IsSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#A9BDDD"),
        ),
        "h2": ParagraphStyle(
            "IsH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=16,
            textColor=NAVY,
            spaceBefore=2,
            spaceAfter=5,
        ),
        "h3": ParagraphStyle(
            "IsH3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=INK,
            spaceBefore=6,
            spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "IsBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.4,
            textColor=INK,
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "IsSmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10.6,
            textColor=INK_MUTED,
        ),
        "cell": ParagraphStyle(
            "IsCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10.4,
            textColor=INK,
        ),
        "cellBold": ParagraphStyle(
            "IsCellBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.8,
            leading=10.4,
            textColor=INK,
        ),
        # Header cells sit on the navy band. A Paragraph carries its own colour
        # and overrides the table's TEXTCOLOR, so the header needs its own style
        # rather than relying on the TableStyle.
        "cellHead": ParagraphStyle(
            "IsCellHead",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.8,
            leading=10.4,
            textColor=colors.white,
        ),
        "mono": ParagraphStyle(
            "IsMono",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=7.6,
            leading=10.2,
            textColor=colors.HexColor("#1D4ED8"),
        ),
        "bullet": ParagraphStyle(
            "IsBullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.4,
            textColor=INK,
            leftIndent=11,
            bulletIndent=2,
            spaceAfter=4,
        ),
    }


def _escape(text: Any) -> str:
    """Minimal XML escaping for ReportLab's inline markup parser."""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _fmt_stamp(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        cleaned = iso.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned).strftime("%d %b %Y, %H:%M UTC")
    except ValueError:
        return iso


# ==========================================================================
# Page furniture
# ==========================================================================


def _draw_chrome(canvas, doc) -> None:  # noqa: ANN001 — ReportLab callback
    """Header band on page 1, footer rule and page number on every page."""
    canvas.saveState()

    if doc.page == 1:
        # Navy masthead band.
        canvas.setFillColor(NAVY)
        canvas.rect(0, PAGE_H - 46 * mm, PAGE_W, 46 * mm, stroke=0, fill=1)

        # Accent stripe along the bottom of the band.
        canvas.setFillColor(BRAND)
        canvas.rect(0, PAGE_H - 46 * mm, PAGE_W * 0.42, 1.4 * mm, stroke=0, fill=1)
        canvas.setFillColor(ICE)
        canvas.rect(
            PAGE_W * 0.42, PAGE_H - 46 * mm, PAGE_W * 0.18, 1.4 * mm, stroke=0, fill=1
        )

        # Shield glyph.
        cx, cy = PAGE_W - MARGIN - 11 * mm, PAGE_H - 25 * mm
        canvas.setStrokeColor(ICE)
        canvas.setLineWidth(1.5)
        p = canvas.beginPath()
        p.moveTo(cx, cy + 9 * mm)
        p.lineTo(cx + 8 * mm, cy + 5.5 * mm)
        p.lineTo(cx + 8 * mm, cy - 1.5 * mm)
        p.curveTo(
            cx + 8 * mm, cy - 6 * mm, cx + 4 * mm, cy - 8.5 * mm, cx, cy - 9.5 * mm
        )
        p.curveTo(
            cx - 4 * mm, cy - 8.5 * mm, cx - 8 * mm, cy - 6 * mm, cx - 8 * mm, cy - 1.5 * mm
        )
        p.lineTo(cx - 8 * mm, cy + 5.5 * mm)
        p.close()
        canvas.drawPath(p, stroke=1, fill=0)

        canvas.setStrokeColor(BRAND)
        canvas.setLineWidth(1.8)
        c = canvas.beginPath()
        c.moveTo(cx - 3.4 * mm, cy + 0.4 * mm)
        c.lineTo(cx - 0.8 * mm, cy - 2.2 * mm)
        c.lineTo(cx + 4.2 * mm, cy + 3.4 * mm)
        canvas.drawPath(c, stroke=1, fill=0)

    # Footer.
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)

    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(INK_MUTED)
    canvas.drawString(
        MARGIN,
        10 * mm,
        "IoTShield Verify — demonstration report. All data is synthetic; figures are illustrative, not experimental results.",
    )
    canvas.drawRightString(PAGE_W - MARGIN, 10 * mm, f"Page {doc.page}")

    canvas.restoreState()


# ==========================================================================
# Building blocks
# ==========================================================================


def _kpi_band(styles: dict[str, ParagraphStyle], kpis: list[tuple[str, str]]) -> Table:
    """A row of headline figures under the masthead."""
    header = [
        Paragraph(
            f'<font size="7" color="#5A6478">{_escape(label.upper())}</font>', styles["small"]
        )
        for label, _ in kpis
    ]
    values = [
        Paragraph(
            f'<font size="15" color="#0F1A2F"><b>{_escape(value)}</b></font>',
            styles["body"],
        )
        for _, value in kpis
    ]

    table = Table([header, values], colWidths=[(PAGE_W - 2 * MARGIN) / len(kpis)] * len(kpis))
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BAND),
                ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 7),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
                ("TOPPADDING", (0, 1), (-1, 1), 0),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 7),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def _section_heading(styles: dict[str, ParagraphStyle], number: int, title: str) -> Table:
    """Numbered section rule, matching the on-screen report."""
    cell = Paragraph(
        f'<font color="#5A6478">{number:02d}</font>&nbsp;&nbsp;{_escape(title)}',
        styles["h2"],
    )
    table = Table([[cell]], colWidths=[PAGE_W - 2 * MARGIN])
    table.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 1.1, BRAND),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def _data_table(
    header: list[str],
    rows: list[list[Any]],
    widths: list[float],
    styles: dict[str, ParagraphStyle],
    colored_column: int | None = None,
    color_map: dict[str, colors.Color] | None = None,
) -> Table:
    """A zebra-striped table with an optional status-coloured column.

    Status colour is applied as inline markup rather than via TableStyle: a
    Paragraph carries its own text colour and would otherwise win.
    """
    head = [Paragraph(_escape(h), styles["cellHead"]) for h in header]

    body: list[list[Paragraph]] = []
    for row in rows:
        cells: list[Paragraph] = []
        for index, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                cells.append(cell)
                continue

            text = _escape(cell)
            if colored_column is not None and index == colored_column and color_map:
                colour = color_map.get(str(cell))
                if colour is not None:
                    text = f'<font color="#{colour.hexval()[2:]}"><b>{text}</b></font>'
            cells.append(Paragraph(text, styles["cell"]))
        body.append(cells)

    table = Table([head] + body, colWidths=widths, repeatRows=1)

    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, NAVY),
        ("GRID", (0, 1), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]

    for i in range(1, len(body) + 1):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), BAND))

    table.setStyle(TableStyle(style))
    return table


# ==========================================================================
# Document
# ==========================================================================


def build_report_pdf(payload: dict[str, Any]) -> bytes:
    """
    Render the incident report.

    ``payload`` is the same structure the ``/reports`` endpoint returns, so the
    JSON and PDF views cannot diverge.
    """
    styles = _styles()
    buffer = io.BytesIO()

    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=22 * mm,
        title=payload.get("title", "IoT Estate Incident Report"),
        author="IoTShield Verify",
        subject="A Formal Verification Approach to IoT Malware Analysis, Detection, and Resilience",
    )

    # Page 1 leaves room for the masthead band; later pages use the full frame.
    first_frame = Frame(
        MARGIN,
        22 * mm,
        PAGE_W - 2 * MARGIN,
        PAGE_H - 22 * mm - 52 * mm,
        id="first",
    )
    later_frame = Frame(
        MARGIN, 22 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 22 * mm - MARGIN, id="later"
    )

    doc.addPageTemplates(
        [
            PageTemplate(id="First", frames=[first_frame], onPage=_draw_chrome),
            PageTemplate(id="Later", frames=[later_frame], onPage=_draw_chrome),
        ]
    )

    story: list[Any] = []
    content_width = PAGE_W - 2 * MARGIN

    summary = payload["summary"]
    resilience = payload["resilience"]
    verification = payload["verification"]
    devices = payload["affectedDevices"]

    failed = [p for p in verification if p["status"] == "Failed"]
    passed = len(verification) - len(failed)

    # ---- KPI band ---------------------------------------------------------
    story.append(
        _kpi_band(
            styles,
            [
                ("Devices online", str(summary["connectedDevices"])),
                ("Requiring attention", str(len(devices))),
                ("Active threats", str(summary["activeThreats"])),
                ("Properties violated", f"{len(failed)}/{len(verification)}"),
                ("Stability", f"{resilience['stability']}%"),
            ],
        )
    )
    story.append(Spacer(1, 5 * mm))

    # ---- Metadata ---------------------------------------------------------
    meta = Table(
        [
            [
                Paragraph(
                    f'<font color="#5A6478">Report ID</font>&nbsp;&nbsp;<b>{_escape(payload["id"])}</b>',
                    styles["small"],
                ),
                Paragraph(
                    f'<font color="#5A6478">Generated</font>&nbsp;&nbsp;<b>{_escape(_fmt_stamp(payload["generatedAt"]))}</b>',
                    styles["small"],
                ),
                Paragraph(
                    f'<font color="#5A6478">Classification</font>&nbsp;&nbsp;<b>{_escape(payload["classification"])}</b>',
                    styles["small"],
                ),
            ]
        ],
        colWidths=[content_width / 3] * 3,
    )
    meta.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(meta)

    # ---- 1. Executive summary ---------------------------------------------
    story.append(_section_heading(styles, 1, "Executive summary"))
    for point in payload["executiveSummary"]:
        story.append(Paragraph(_escape(point), styles["bullet"], bulletText="•"))

    # ---- 2. Affected devices ------------------------------------------------
    story.append(_section_heading(styles, 2, "Affected devices"))
    if devices:
        rows = [
            [
                d["name"],
                d["ip"],
                d["status"],
                d["risk"],
                str(d["health"]),
                d.get("infectedBy") or "—",
            ]
            for d in devices[:14]
        ]
        story.append(
            _data_table(
                ["Device", "Address", "Status", "Risk", "Health", "Attribution"],
                rows,
                [
                    content_width * 0.28,
                    content_width * 0.16,
                    content_width * 0.15,
                    content_width * 0.12,
                    content_width * 0.09,
                    content_width * 0.20,
                ],
                styles,
                colored_column=3,
                color_map=SEVERITY_COLOR,
            )
        )
        if len(devices) > 14:
            story.append(Spacer(1, 2 * mm))
            story.append(
                Paragraph(
                    f"{len(devices) - 14} further device(s) omitted for brevity.",
                    styles["small"],
                )
            )
    else:
        story.append(
            Paragraph("No devices currently require attention.", styles["body"])
        )

    # ---- 3. Threat timeline --------------------------------------------------
    story.append(_section_heading(styles, 3, "Threat timeline"))
    timeline_rows = [
        [
            _fmt_stamp(entry["at"]),
            entry["severity"],
            Paragraph(
                f'<b>{_escape(entry["label"])}</b><br/>{_escape(entry["detail"])}',
                styles["cell"],
            ),
        ]
        for entry in payload["timeline"][:12]
    ]
    if timeline_rows:
        story.append(
            _data_table(
                ["Time", "Severity", "Event"],
                timeline_rows,
                [content_width * 0.22, content_width * 0.13, content_width * 0.65],
                styles,
                colored_column=1,
                color_map=SEVERITY_COLOR,
            )
        )

    # ---- 4. Verification results ---------------------------------------------
    story.append(_section_heading(styles, 4, "Formal verification results"))
    story.append(
        Paragraph(
            f"<b>{passed}</b> of <b>{len(verification)}</b> temporal-logic properties are "
            f"satisfied against the current marking; <b>{len(failed)}</b> are violated.",
            styles["body"],
        )
    )

    story.append(
        _data_table(
            ["Property", "Logic", "Formula", "Result"],
            [
                [
                    p["name"],
                    p["logic"],
                    Paragraph(_escape(p["formula"]), styles["mono"]),
                    p["status"],
                ]
                for p in verification
            ],
            [
                content_width * 0.26,
                content_width * 0.09,
                content_width * 0.47,
                content_width * 0.18,
            ],
            styles,
            colored_column=3,
            color_map=STATUS_COLOR,
        )
    )

    for prop in failed:
        story.append(Spacer(1, 3 * mm))
        story.append(
            KeepTogether(
                [
                    Paragraph(
                        f'<font color="#D03B3B"><b>Violated — {_escape(prop["name"])}</b></font>',
                        styles["h3"],
                    ),
                    Paragraph(_escape(prop["reason"]), styles["body"]),
                    Paragraph(
                        f'<b>Recommendation.</b> {_escape(prop["recommendation"])}',
                        styles["body"],
                    ),
                ]
            )
        )

    # ---- 5. Resilience assessment ----------------------------------------------
    story.append(_section_heading(styles, 5, "Resilience assessment"))
    story.append(
        _kpi_band(
            styles,
            [
                ("Containment", f"{resilience['containment']}%"),
                ("Recovery", f"{resilience['recovery']}%"),
                ("Risk reduction", f"{resilience['riskReduction']}%"),
                ("Stability", f"{resilience['stability']}%"),
            ],
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(
        Paragraph(
            f"Mean time to detect <b>{resilience['mttdSec']}s</b> · "
            f"mean time to contain <b>{resilience['mttcSec']}s</b> · "
            f"mean time to recover <b>{round(resilience['mttrSec'] / 60)} min</b>. "
            f"{resilience['devicesIsolated']} device(s) isolated, "
            f"{resilience['devicesRecovered']} recovered, "
            f"{resilience['devicesPendingRecovery']} pending.",
            styles["body"],
        )
    )

    story.append(Paragraph("Recovery workflow", styles["h3"]))
    story.append(
        _data_table(
            ["Stage", "Mode", "Status", "Detail"],
            [
                [
                    step["label"],
                    "Automated" if step["automated"] else "Manual",
                    step["status"],
                    Paragraph(_escape(step["description"]), styles["cell"]),
                ]
                for step in resilience["workflow"]
            ],
            [
                content_width * 0.22,
                content_width * 0.12,
                content_width * 0.13,
                content_width * 0.53,
            ],
            styles,
        )
    )

    # ---- 6. Recommendations ------------------------------------------------------
    story.append(_section_heading(styles, 6, "Recommendations"))
    for i, rec in enumerate(payload["recommendations"], start=1):
        story.append(
            KeepTogether(
                [
                    Paragraph(
                        f'{i}. <b>{_escape(rec["title"])}</b> '
                        f'<font size="7" color="#5A6478">[{_escape(rec["priority"])} priority]</font>',
                        styles["h3"],
                    ),
                    Paragraph(_escape(rec["detail"]), styles["body"]),
                ]
            )
        )

    # ---- Provenance ----------------------------------------------------------------
    story.append(Spacer(1, 5 * mm))
    provenance = Table(
        [
            [
                Paragraph(
                    "<b>Provenance.</b> This assessment was generated from the IoTShield Verify "
                    "demonstration dataset. Every device, event, alert, verification verdict and "
                    "metric it references is synthetic. Malware tradecraft descriptions are drawn "
                    "from public reporting on real families; all quantitative values are "
                    "illustrative and are not experimental results from the underlying research.",
                    styles["small"],
                )
            ]
        ],
        colWidths=[content_width],
    )
    provenance.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BAND),
                ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(provenance)

    # The masthead text sits on the canvas, not in the frame, so it is drawn
    # after the story is laid out and cannot be pushed by content reflow.
    def _masthead(canvas, doc_):  # noqa: ANN001 — ReportLab callback
        _draw_chrome(canvas, doc_)
        if doc_.page != 1:
            return
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 21)
        canvas.setFillColor(colors.white)
        canvas.drawString(MARGIN, PAGE_H - 22 * mm, "IoT Estate Incident Report")
        canvas.setFont("Helvetica", 9.5)
        canvas.setFillColor(colors.HexColor("#A9BDDD"))
        canvas.drawString(
            MARGIN,
            PAGE_H - 28.5 * mm,
            "IoTShield Verify — A Formal Verification Approach to IoT Malware Analysis,",
        )
        canvas.drawString(
            MARGIN, PAGE_H - 33.5 * mm, "Detection, and Resilience"
        )
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#7E93B8"))
        canvas.drawString(
            MARGIN,
            PAGE_H - 41 * mm,
            "MSc research demonstration · synthetic data throughout",
        )
        canvas.restoreState()

    doc.pageTemplates[0].onPage = _masthead
    doc.pageTemplates[1].onPage = _draw_chrome

    doc.build(story)

    pdf = buffer.getvalue()
    buffer.close()
    return pdf


# ==========================================================================
# Payload assembly
# ==========================================================================


def build_report_payload(
    devices: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    verification: list[dict[str, Any]],
    resilience: dict[str, Any],
    summary: dict[str, Any],
    simulation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Assemble the report structure served by ``/reports`` and rendered by
    ``build_report_pdf``. Kept in one place so JSON and PDF cannot diverge.
    """
    severity_rank = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
    generated_at = datetime.now(timezone.utc)

    if simulation and simulation.get("affectedDeviceIds"):
        affected_ids = set(simulation["affectedDeviceIds"])
        affected = [d for d in devices if d["id"] in affected_ids]
    else:
        affected = sorted(
            (d for d in devices if d["status"] not in ("Healthy", "Offline")),
            key=lambda d: severity_rank[d["risk"]],
            reverse=True,
        )[:10]

    failed = [p for p in verification if p["status"] == "Failed"]
    passed = len(verification) - len(failed)
    active = [a for a in alerts if a["status"] in ("Open", "Investigating")]
    critical = [a for a in alerts if a["severity"] == "Critical"]

    if simulation:
        timeline = [
            {
                "at": _iso_offset(simulation["startedAt"], step["atOffsetMs"]),
                "label": f"{step['phase']} — {step['label']}",
                "detail": step["detail"],
                "severity": step["severity"],
            }
            for step in simulation["steps"]
        ]
    else:
        timeline = [
            {
                "at": a["timestamp"],
                "label": a["threat"],
                "detail": f"{a['deviceName']} — {a['description']}",
                "severity": a["severity"],
            }
            for a in alerts[:8]
        ]

    plural = "" if len(affected) == 1 else "s"
    executive_summary = [
        (
            f"A {simulation['scenarioLabel']} scenario was executed against the modelled estate "
            f"of {len(devices)} devices. {simulation['outcome']}"
            if simulation
            else "No attack scenario has been executed. This assessment describes the standing "
            f"baseline across the modelled estate of {len(devices)} devices."
        ),
        (
            f"{len(affected)} device{plural} require attention, with {len(active)} alert(s) open "
            f"or under investigation and {len(critical)} at critical severity."
        ),
        (
            f"Formal verification of the Coloured Petri Net model returned {passed} of "
            f"{len(verification)} properties satisfied."
            + (
                f" The violated propert{'y is' if len(failed) == 1 else 'ies are'} "
                + " and ".join(p["name"] for p in failed)
                + "."
                if failed
                else " No violations were found against the markings reached."
            )
        ),
        (
            "The violations are not detector faults. In every observed run the response "
            "succeeded: threats were caught and devices quarantined. What model checking "
            "establishes is that containment is reachable but not inevitable — a class of "
            "defect testing cannot surface, because it is a property of the state space rather "
            "than of any single execution."
            if failed
            else "Containment held across every marking visited. Note that this is a property of "
            "the runs performed, not a general guarantee; the baseline model retains violations "
            "that these runs did not reach."
        ),
        (
            f"Containment currently stands at {resilience['containment']}%, recovery at "
            f"{resilience['recovery']}%, and estate stability at {resilience['stability']}%. "
            f"Mean time to detect is {resilience['mttdSec']}s and mean time to contain is "
            f"{resilience['mttcSec']}s."
        ),
    ]

    recommendations = [
        {
            "priority": "Critical",
            "title": f"Remediate: {p['name']}",
            "detail": p["recommendation"],
        }
        for p in failed
    ]

    outdated = sum(1 for d in devices if d["firmwareOutdated"])
    if outdated:
        recommendations.append(
            {
                "priority": "High",
                "title": "Close the firmware gap",
                "detail": (
                    f"{outdated} of {len(devices)} devices are running a build with a newer "
                    "version available. Firmware patching, not credential hygiene alone, is what "
                    "defeats the exploit-carrying families in this corpus."
                ),
            }
        )

    recommendations.extend(
        [
            {
                "priority": "High",
                "title": "Eliminate factory credentials at enrolment",
                "detail": (
                    "Reject vendor defaults at provisioning and force a rotation at first boot. "
                    "The majority of intrusions modelled here begin with a credential that was "
                    "never changed."
                ),
            },
            {
                "priority": "Medium",
                "title": "Tighten segment egress policy",
                "detail": (
                    "Deny Telnet (23/2323) inbound at every segment boundary and block DHT "
                    "bootstrap egress from device VLANs. This removes both the primary entry "
                    "vector and the peer-to-peer control channel used by the families with no "
                    "central controller."
                ),
            },
            {
                "priority": "Medium",
                "title": "Maintain verified offline firmware images",
                "detail": (
                    "Keep a known-good image for every device model in the estate. Destructive "
                    "families leave physical reflashing as the only recovery path, and that path "
                    "must not depend on vendor availability at the time of the incident."
                ),
            },
        ]
    )

    return {
        "id": f"IR-{generated_at.strftime('%Y%m%d-%H%M%S')}",
        "title": "IoT Estate Incident Report",
        "generatedAt": generated_at.strftime("%Y-%m-%dT%H:%M:%S.")
        + f"{generated_at.microsecond // 1000:03d}Z",
        "classification": "Demonstration — synthetic data",
        "author": "IoTShield Verify",
        "executiveSummary": executive_summary,
        "affectedDevices": affected,
        "timeline": timeline,
        "verification": verification,
        "resilience": resilience,
        "recommendations": recommendations,
        "summary": summary,
    }


def _iso_offset(started_at: str, offset_ms: int) -> str:
    base = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    shifted = base.timestamp() * 1000 + offset_ms
    dt = datetime.fromtimestamp(shifted / 1000, tz=timezone.utc)
    return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}.{dt.microsecond // 1000:03d}Z"
