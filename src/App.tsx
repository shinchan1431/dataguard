import { useMemo, useRef, useState } from 'react'
import { datasets } from './data'
import { parseCsvFile } from './csvParser'
import { runAllChecks } from './engine'
import type { CheckResult, CheckId, DatasetSchema, Severity } from './types'
import './index.css'

const severityLabel: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
}

function StatusBadge({ passed, severity }: { passed: boolean; severity: Severity }) {
  const cls = passed ? 'badge badge-pass' : `badge badge-${severity}`
  return <span className={cls}>{passed ? 'Passed' : severityLabel[severity]}</span>
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function CheckCard({ result, active, onClick }: { result: CheckResult; active: boolean; onClick: () => void }) {
  const cleanPct = result.total === 0 ? 100 : Math.round(((result.total - result.issues) / result.total) * 100)
  return (
    <button className={`check-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="check-card-head">
        <span className="check-title">{result.title}</span>
        <StatusBadge passed={result.passed} severity={result.severity} />
      </div>
      <p className="check-desc">{result.description}</p>
      <div className="check-stats">
        <span className="stat-label">Clean rate</span>
        <span className="stat-value">{cleanPct}%</span>
      </div>
      <ProgressBar pct={cleanPct} />
      <div className="check-footer">
        <span>{result.issues} issue{result.issues !== 1 ? 's' : ''} found</span>
      </div>
    </button>
  )
}

function IssueTable({ result }: { result: CheckResult }) {
  if (result.rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">✓</div>
        <h3>No issues detected</h3>
        <p>This check passed with no findings.</p>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table className="issue-table">
        <thead>
          <tr>
            <th>Row</th>
            <th>Column</th>
            <th>Value</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 200).map((row, i) => (
            <tr key={i}>
              <td>{row.rowIndex === -1 ? '—' : row.rowIndex + 1}</td>
              <td>{row.column}</td>
              <td className={row.value ? '' : 'muted'}>{row.value || '(empty)'}</td>
              <td>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.rows.length > 200 && (
        <p className="table-note">
          Showing first 200 of {result.rows.length} issues.
        </p>
      )}
    </div>
  )
}

export default function App() {
  const [datasetIdx, setDatasetIdx] = useState(0)
  const [uploadedDataset, setUploadedDataset] = useState<DatasetSchema | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeCheck, setActiveCheck] = useState<CheckId | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const dataset = uploadedDataset ?? datasets[datasetIdx]

  const results = useMemo(
    () => runAllChecks(dataset),
    [dataset]
  )

  const active = results.find((r) => r.id === activeCheck) || null

  const totalIssues = results.reduce((sum, r) => sum + r.issues, 0)
  const passedChecks = results.filter((r) => r.passed).length

  const overallScore = Math.round(
    ((4 - (totalIssues > 8 ? 8 : totalIssues)) / 4) * 100
  )

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please select a CSV file.')
      return
    }

    setUploadError(null)
    setActiveCheck(null)

    try {
      const parsedDataset = await parseCsvFile(file)
      setUploadedDataset(parsedDataset)
    } catch (error) {
      setUploadedDataset(null)

      setUploadError(
        error instanceof Error
          ? error.message
          : 'Unable to parse the CSV file.'
      )
    } finally {
      event.target.value = ''
    }
  }

  const handleSampleDataset = (index: number) => {
    setDatasetIdx(index)
    setUploadedDataset(null)
    setUploadError(null)
    setActiveCheck(null)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">

          <div className="brand">
            <div className="brand-mark">DQ</div>

            <div>
              <h1>DataGuard</h1>
              <p className="brand-sub">
                Automated data quality checks for engineering pipelines
              </p>
            </div>
          </div>

          <div className="dataset-switch">

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <button
              className="ds-btn upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload CSV
            </button>

            {datasets.map((d, i) => (
              <button
                key={d.name}
                className={`ds-btn ${
                  !uploadedDataset && i === datasetIdx ? 'on' : ''
                }`}
                onClick={() => handleSampleDataset(i)}
              >
                {d.name}
              </button>
            ))}

          </div>
        </div>
      </header>

      <main className="main">

        {uploadError && (
          <div className="upload-error" role="alert">
            <strong>CSV upload failed:</strong> {uploadError}
          </div>
        )}

        {uploadedDataset && (
          <div className="upload-success">
            Analyzing <strong>{uploadedDataset.name}</strong> locally in your browser.
          </div>
        )}

        <section className="overview">

          <div className="metric">
            <span className="metric-label">Records</span>
            <span className="metric-value">
              {dataset.rows.length}
            </span>
          </div>

          <div className="metric">
            <span className="metric-label">Columns</span>
            <span className="metric-value">
              {dataset.columns.length}
            </span>
          </div>

          <div className="metric">
            <span className="metric-label">Checks Passed</span>
            <span className="metric-value">
              {passedChecks}/4
            </span>
          </div>

          <div className="metric">
            <span className="metric-label">Total Issues</span>
            <span
              className={`metric-value ${
                totalIssues > 0 ? 'warn' : ''
              }`}
            >
              {totalIssues}
            </span>
          </div>

          <div className="metric score">
            <span className="metric-label">Quality Score</span>
            <span
              className={`metric-value ${
                overallScore >= 75
                  ? 'good'
                  : overallScore >= 50
                    ? 'warn'
                    : 'bad'
              }`}
            >
              {overallScore}
            </span>
          </div>

        </section>

        <section className="checks-grid">
          {results.map((r) => (
            <CheckCard
              key={r.id}
              result={r}
              active={activeCheck === r.id}
              onClick={() =>
                setActiveCheck(
                  activeCheck === r.id ? null : r.id
                )
              }
            />
          ))}
        </section>

        {active && (
          <section className="detail">

            <div className="detail-head">
              <h2>{active.title}</h2>
              <StatusBadge
                passed={active.passed}
                severity={active.severity}
              />
            </div>

            <IssueTable result={active} />

          </section>
        )}

        <section className="preview">

          <h2>
            Dataset Preview — {dataset.name}
          </h2>

          <div className="table-wrap">

            <table className="data-table">

              <thead>
                <tr>
                  <th>#</th>

                  {dataset.columns.map((c) => (
                    <th key={c.key}>
                      {c.key}
                      <span className="col-type">
                        {c.type}
                      </span>
                    </th>
                  ))}

                </tr>
              </thead>

              <tbody>

                {dataset.rows.map((row, i) => (
                  <tr key={i}>

                    <td className="row-num">
                      {i + 1}
                    </td>

                    {dataset.columns.map((c) => {

                      const v = row[c.key]

                      const empty =
                        v === null ||
                        v === undefined ||
                        v === ''

                      return (
                        <td
                          key={c.key}
                          className={empty ? 'muted' : ''}
                        >
                          {empty ? '—' : String(v)}
                        </td>
                      )
                    })}

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        </section>

      </main>

      <footer className="footer">
        <p>
          DataGuard · Missing values · Duplicates · Invalid records · Drift detection
        </p>
      </footer>

    </div>
  )
}
