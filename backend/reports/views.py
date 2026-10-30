import json
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.renderers import StaticHTMLRenderer
from django.http import HttpResponse

from .models import Report
from .serializers import ReportSerializer, CreateReportSerializer
from .services import ReportService


class ReportViewSet(viewsets.ModelViewSet):
    """
    GET /api/reports/
    POST /api/reports/
    GET /api/reports/<id>/
    GET /api/reports/<id>/export/?format=json
    GET /api/reports/<id>/download/?format=html|json|pdf
    Manage formal forensic investigation reports.
    """
    queryset = Report.objects.all().select_related('investigation', 'investigation__wallet')
    serializer_class = ReportSerializer
    permission_classes = (permissions.AllowAny,)

    def perform_content_negotiation(self, request, force=False):
        # Allow format=html or format=pdf query parameters for download without DRF 404
        if getattr(self, 'action', None) in ('download', 'export'):
            return (StaticHTMLRenderer(), 'text/html')
        return super().perform_content_negotiation(request, force=force)

    def get_queryset(self):
        qs = Report.objects.all().select_related('investigation', 'investigation__wallet')
        wallet = self.request.query_params.get('wallet_address')
        if wallet:
            qs = qs.filter(wallet_address__iexact=wallet.strip().lower())
        inv_id = self.request.query_params.get('investigation_id')
        if inv_id and inv_id.isdigit():
            qs = qs.filter(investigation_id=int(inv_id))
        return qs

    def create(self, request, *args, **kwargs):
        serializer = CreateReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        report = ReportService.generate_report(
            title=data.get('title') or 'Forensic Intelligence Dossier',
            notes=data.get('notes', ''),
            wallet_address=data.get('wallet_address'),
            investigation_id=data.get('investigation_id'),
            user=request.user
        )

        response_serializer = ReportSerializer(report)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """Export report as downloadable JSON file blob"""
        report = self.get_object()
        report_data = ReportSerializer(report).data

        json_str = json.dumps(report_data, indent=2, default=str)
        response = HttpResponse(json_str, content_type='application/json')
        filename = f"vasp_report_{report.id}_{report.reference_id or 'export'}.json"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """
        GET /api/reports/<id>/download/?format=html|json|pdf
        Renders a printable, publication-quality forensic dossier.
        """
        report = self.get_object()
        export_format = request.query_params.get('format', 'html').lower()

        if export_format == 'json':
            return self.export(request, pk=pk)

        # Generate styled printable HTML report (save-as-PDF ready)
        findings = report.findings or {}
        details = findings.get('investigation_details', {})
        wallet_analysis = findings.get('wallet_analysis', {})
        tx_findings = findings.get('transaction_findings', {})
        vasp_intel = findings.get('vasp_intelligence', {})
        ai_exp = findings.get('ai_investigation_explanation', {})
        evidence = findings.get('evidence', {})

        html_content = self._render_printable_html(
            report=report,
            findings=findings,
            details=details,
            wallet_analysis=wallet_analysis,
            tx_findings=tx_findings,
            vasp_intel=vasp_intel,
            ai_exp=ai_exp,
            evidence=evidence
        )

        response = HttpResponse(html_content, content_type='text/html; charset=utf-8')
        if export_format == 'pdf':
            # Provides HTML styled with @media print so browser or PDF generator saves cleanly
            response['Content-Disposition'] = f'inline; filename="investigation_report_{report.id}.html"'
        return response

    def _render_printable_html(self, report, findings, details, wallet_analysis, tx_findings, vasp_intel, ai_exp, evidence):
        candidates = vasp_intel.get('candidates', [])
        candidates_rows = ""
        if candidates:
            for c in candidates:
                candidates_rows += f"""
                <tr>
                    <td><strong>#{c.get('rank', 1)}</strong></td>
                    <td><strong>{c.get('vasp_name', 'N/A')}</strong><br><small>{c.get('jurisdiction', '')}</small></td>
                    <td><span class="badge badge-score">{c.get('score', 0):.1f}%</span></td>
                    <td><span class="badge badge-conf">{c.get('confidence', '').upper()}</span></td>
                    <td>{c.get('distance_hops', 1)} hop(s)</td>
                    <td>{c.get('interaction_count', 0)}</td>
                </tr>
                """
        else:
            candidates_rows = """
            <tr>
                <td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">
                    No VASP association identified from the available on-chain evidence.
                </td>
            </tr>
            """

        observed_ev_items = "".join(f"<li>{ev}</li>" for ev in evidence.get('observed_evidence', []))
        system_attr_items = "".join(f"<li>{sa}</li>" for sa in evidence.get('system_attribution', []))
        discoveries_items = "".join(f"<li>{d}</li>" for d in ai_exp.get('discoveries', []))

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Investigation Report #{report.id} - {report.wallet_address}</title>
    <style>
        @page {{
            size: A4;
            margin: 1.5cm;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.5;
            font-size: 13px;
            margin: 0;
            padding: 20px;
        }}
        .header {{
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }}
        .header h1 {{
            margin: 0;
            font-size: 22px;
            color: #0369a1;
            font-weight: 700;
        }}
        .header .subtitle {{
            margin: 4px 0 0 0;
            font-size: 13px;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 14px;
            margin-bottom: 24px;
        }}
        .meta-item {{
            font-size: 12px;
        }}
        .meta-label {{
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
        }}
        .meta-value {{
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 600;
            color: #0f172a;
        }}
        h2 {{
            font-size: 15px;
            color: #0f172a;
            border-left: 4px solid #0284c7;
            padding-left: 8px;
            margin: 24px 0 10px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        p {{
            margin: 0 0 10px 0;
            color: #334155;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0 20px 0;
            font-size: 12px;
        }}
        th, td {{
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            text-align: left;
        }}
        th {{
            background: #f1f5f9;
            color: #475569;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
        }}
        .badge {{
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
        }}
        .badge-score {{
            background: #e0f2fe;
            color: #0369a1;
        }}
        .badge-conf {{
            background: #dcfce7;
            color: #15803d;
        }}
        .section-box {{
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 16px;
        }}
        ul {{
            margin: 6px 0 10px 20px;
            padding: 0;
            color: #334155;
        }}
        li {{
            margin-bottom: 4px;
        }}
        .footer {{
            margin-top: 36px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
        }}
        @media print {{
            body {{
                padding: 0;
            }}
            .no-print {{
                display: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 16px; text-align: right;">
        <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
            Print / Save to PDF
        </button>
    </div>

    <div class="header">
        <div>
            <h1>Smart Wallet-to-VASP Mapping</h1>
            <div class="subtitle">Official Forensic Investigation Report</div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div>Report Ref: <strong>{report.reference_id or f'REP-{report.id}'}</strong></div>
            <div>Generated: {report.created_at.strftime('%Y-%m-%d %H:%M UTC') if report.created_at else ''}</div>
        </div>
    </div>

    <div class="meta-grid">
        <div class="meta-item">
            <span class="meta-label">Investigation Name</span>
            <span class="meta-value">{details.get('investigation_name', report.title)}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Investigation ID</span>
            <span class="meta-value">#{details.get('investigation_id', report.investigation_id or report.id)}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Target Wallet Address</span>
            <span class="meta-value">{report.wallet_address}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Blockchain / Network</span>
            <span class="meta-value">{details.get('blockchain_network', 'Ethereum').upper()}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Analysis Depth</span>
            <span class="meta-value">{details.get('analysis_depth', 2)} Hops</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Assessed Risk Level</span>
            <span class="meta-value">{report.risk_level.upper()}</span>
        </div>
    </div>

    <h2>1. Executive Summary</h2>
    <div class="section-box">
        <p>{report.summary}</p>
    </div>

    <h2>2. Wallet & Transaction Findings</h2>
    <div class="section-box">
        <table style="margin: 0;">
            <tr>
                <th>Transactions Analyzed</th>
                <th>Total Inflow</th>
                <th>Total Outflow</th>
                <th>Counterparties</th>
                <th>Risk Profile</th>
            </tr>
            <tr>
                <td><strong>{wallet_analysis.get('transactions_analyzed', 0)}</strong></td>
                <td>{wallet_analysis.get('incoming_activity', {}).get('total_inflow', 0):.4f}</td>
                <td>{wallet_analysis.get('outgoing_activity', {}).get('total_outflow', 0):.4f}</td>
                <td>{wallet_analysis.get('counterparties_count', 0)} unique</td>
                <td>{wallet_analysis.get('risk_level', 'low').upper()}</td>
            </tr>
        </table>
    </div>

    <h2>3. VASP Intelligence Candidates</h2>
    <table>
        <thead>
            <tr>
                <th>Rank</th>
                <th>VASP Entity</th>
                <th>Attribution Score</th>
                <th>Confidence</th>
                <th>Distance</th>
                <th>Interactions</th>
            </tr>
        </thead>
        <tbody>
            {candidates_rows}
        </tbody>
    </table>

    <h2>4. Observed Blockchain Evidence vs System Attribution</h2>
    <div class="section-box">
        <strong>Observed Blockchain Evidence (Hard Facts):</strong>
        <ul>
            {observed_ev_items or '<li>No direct transactional evidence recorded.</li>'}
        </ul>
        <strong style="margin-top: 12px; display: block;">System Attribution Assessment:</strong>
        <ul>
            {system_attr_items or '<li>Topological proximity analysis produced no affirmative attribution links.</li>'}
        </ul>
    </div>

    <h2>5. AI Investigation Explanation</h2>
    <div class="section-box">
        <p><strong>Scope:</strong> {ai_exp.get('analysis_scope', 'N/A')}</p>
        <p><strong>Key Discoveries:</strong></p>
        <ul>
            {discoveries_items or '<li>No notable telemetry anomalies recorded.</li>'}
        </ul>
        <p><strong>Forensic Interpretation:</strong> {ai_exp.get('interpretation', 'N/A')}</p>
    </div>

    <h2>6. Dynamic Conclusion</h2>
    <div class="section-box" style="background: #f8fafc; border-left: 4px solid #0284c7;">
        <p style="margin: 0; font-weight: 500;">{report.conclusion or 'Investigation concluded based on available on-chain telemetry.'}</p>
    </div>

    <div class="footer">
        <div>Smart Wallet-to-VASP Mapping • Forensic Blockchain Analysis Platform</div>
        <div>Data Sources: Blockchain Provider (Alchemy) | VASP Registry | Heuristic Engine</div>
    </div>
</body>
</html>
        """
