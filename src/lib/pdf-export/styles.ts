export function getStyles(): string {
    return `<style>
        :root {
            --color-primary: #1D1D1F;
            --color-secondary: #6E6E73;
            --color-divider: #E5E5EA;
            --color-background: #FFFFFF;
        }

        @page {
            margin: 40px 48px 40px 72px;
            size: A4;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: var(--color-primary);
            background: var(--color-background);
            font-size: 13px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        .page-section {
            margin-bottom: 40px;
        }

        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--color-primary);
            margin-bottom: 12px;
            letter-spacing: -0.2px;
            page-break-after: avoid;
        }

        .section-divider {
            border: none;
            border-top: 1px solid var(--color-divider);
            margin: 24px 0;
        }

        .avoid-break {
            page-break-inside: avoid;
        }

        /* Cover */
        .cover {
            text-align: center;
            padding: 60px 0 40px;
        }

        .cover-title {
            font-size: 22px;
            font-weight: 600;
            color: var(--color-primary);
            letter-spacing: -0.3px;
            margin-bottom: 8px;
        }

        .cover-date {
            font-size: 13px;
            color: var(--color-secondary);
        }

        .cover-meta {
            font-size: 11px;
            color: var(--color-secondary);
            margin-top: 4px;
        }

        /* Patient info */
        .patient-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 40px;
        }

        .patient-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid var(--color-divider);
        }

        .patient-label {
            font-size: 13px;
            color: var(--color-secondary);
        }

        .patient-value {
            font-size: 13px;
            font-weight: 500;
            color: var(--color-primary);
            text-align: right;
        }

        /* Summary */
        .summary-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .summary-badge {
            font-size: 11px;
            color: var(--color-secondary);
            background: #F5F5F7;
            padding: 4px 10px;
            border-radius: 6px;
        }

        .summary-badge strong {
            color: var(--color-primary);
            font-weight: 600;
        }

        /* Metric cards */
        .metric-card {
            border: 1px solid var(--color-divider);
            border-radius: 10px;
            padding: 14px 16px;
            margin-bottom: 10px;
            page-break-inside: avoid;
        }

        .metric-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 6px;
        }

        .metric-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--color-primary);
        }

        .metric-latest {
            font-size: 14px;
            font-weight: 500;
            color: var(--color-primary);
        }

        .metric-latest-date {
            font-size: 11px;
            color: var(--color-secondary);
        }

        .metric-stats {
            display: flex;
            gap: 16px;
            margin-top: 4px;
        }

        .metric-stat {
            font-size: 11px;
            color: var(--color-secondary);
        }

        .metric-stat strong {
            color: var(--color-primary);
            font-weight: 500;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        thead {
            display: table-header-group;
        }

        tbody tr {
            page-break-inside: avoid;
        }

        thead th {
            text-align: left;
            font-weight: 600;
            font-size: 11px;
            color: var(--color-secondary);
            text-transform: uppercase;
            letter-spacing: 0.3px;
            padding: 8px 10px;
            border-bottom: 1px solid var(--color-divider);
        }

        tbody td {
            padding: 8px 10px;
            border-bottom: 1px solid var(--color-divider);
            color: var(--color-primary);
            vertical-align: top;
        }

        tbody tr:last-child td {
            border-bottom: none;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        .text-muted {
            color: var(--color-secondary);
        }

        .text-small {
            font-size: 11px;
        }

        /* ALSFRS total row */
        .alsfrs-total td {
            font-weight: 600;
            border-top: 1px solid var(--color-divider);
        }

        /* Disclaimer */
        .disclaimer {
            font-size: 11px;
            color: var(--color-secondary);
            line-height: 1.6;
            border-top: 1px solid var(--color-divider);
            padding-top: 16px;
            margin-top: 40px;
        }

    </style>`;
}
