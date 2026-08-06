import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { analyzeEmail } from './ai'
import type { EmailAnalysis } from './ai'
import './index.css'

type View = 'inbox' | 'tasks' | 'crm' | 'style'

interface Email {
  id: string
  from_address: string
  from_name: string | null
  to_address: string
  subject: string
  body: string
  received_at: string
  thread_id: string
  is_read: boolean
  ai_intent: string | null
  ai_emotion: string | null
  ai_emotion_score: number | null
  ai_urgency: string | null
  ai_fraud_risk: number | null
  ai_fraud_flags: string[] | null
  ai_satisfaction: number | null
  ai_summary: string | null
  ai_next_action: string | null
  ai_reply_draft: string | null
  ai_analyzed_at: string | null
  status: string
}

interface Task {
  id: string
  email_id: string | null
  title: string
  description: string | null
  priority: string
  due_date: string | null
  status: string
  created_at: string
}

interface CrmContact {
  id: string
  email: string
  name: string | null
  company: string | null
  tier: string
  status: string
  satisfaction_trend: string | null
  last_contact_at: string | null
  notes: string | null
  created_at: string
}

interface WritingSample {
  id: string
  content: string
  tone: string
  created_at: string
}

const intentColor: Record<string, string> = {
  inquiry: '#0ea5e9', complaint: '#ef4444', support: '#f59e0b', billing: '#8b5cf6',
  meeting_request: '#14b8a6', fraud: '#dc2626', praise: '#22c55e', other: '#64748b',
}
const emotionColor: Record<string, string> = {
  positive: '#22c55e', neutral: '#64748b', frustrated: '#f59e0b',
  angry: '#ef4444', confused: '#0ea5e9', urgent: '#f97316',
}
const urgencyColor: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function Chip({ label, color, value }: { label: string; color: string; value?: string }) {
  return (
    <span className="chip" style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
      {label}{value !== undefined ? ` · ${value}` : ''}
    </span>
  )
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="score-bar">
      <div className="score-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('inbox')
  const [emails, setEmails] = useState<Email[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [crm, setCrm] = useState<CrmContact[]>([])
  const [samples, setSamples] = useState<WritingSample[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [style, setStyle] = useState({ tone: 'friendly', signature: 'Best regards,\nThe Team' })
  const [newSample, setNewSample] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: em }, { data: tk }, { data: cr }, { data: ws }] = await Promise.all([
      supabase.from('emails').select('*').order('received_at', { ascending: false }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_contacts').select('*').order('created_at', { ascending: false }),
      supabase.from('writing_samples').select('*').order('created_at', { ascending: false }),
    ])
    setEmails(em || [])
    setTasks(tk || [])
    setCrm(cr || [])
    setSamples(ws || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const sampleContents = samples.map((s) => s.content)
  const selected = emails.find((e) => e.id === selectedId) || null

  const runAnalysis = async (email: Email) => {
    setAnalyzing(true)
    // Simulate AI processing delay
    await new Promise((r) => setTimeout(r, 600))
    const analysis: EmailAnalysis = analyzeEmail(email.subject, email.body, email.from_name, {
      tone: style.tone,
      signature: style.signature,
      samples: sampleContents,
    })
    await supabase.from('emails').update({
      ai_intent: analysis.intent,
      ai_emotion: analysis.emotion,
      ai_emotion_score: analysis.emotionScore,
      ai_urgency: analysis.urgency,
      ai_fraud_risk: analysis.fraudRisk,
      ai_fraud_flags: analysis.fraudFlags,
      ai_satisfaction: analysis.satisfaction,
      ai_summary: analysis.summary,
      ai_next_action: analysis.nextAction,
      ai_reply_draft: analysis.replyDraft,
      ai_analyzed_at: new Date().toISOString(),
      status: 'triaged',
      is_read: true,
    }).eq('id', email.id)
    await supabase.from('actions').insert({
      email_id: email.id, type: 'analyze', label: 'AI analyzed email',
      detail: `Intent: ${analysis.intent} · Emotion: ${analysis.emotion} · Urgency: ${analysis.urgency}`,
      performed_by: 'ai',
    })
    // Auto-create task for high-urgency non-fraud emails
    if ((analysis.urgency === 'high' || analysis.urgency === 'critical') && analysis.fraudRisk < 50) {
      await supabase.from('tasks').insert({
        email_id: email.id,
        title: `Follow up: ${email.subject}`,
        description: analysis.nextAction,
        priority: analysis.urgency === 'critical' ? 'high' : 'medium',
        status: 'pending',
      })
    }
    // Auto-upsert CRM contact
    const existing = crm.find((c) => c.email === email.from_address)
    if (!existing) {
      await supabase.from('crm_contacts').insert({
        email: email.from_address,
        name: email.from_name,
        company: null,
        tier: 'free',
        status: 'lead',
        satisfaction_trend: analysis.satisfaction > 70 ? 'stable' : 'declining',
        last_contact_at: email.received_at,
        notes: `Auto-created from email. Predicted satisfaction: ${analysis.satisfaction}`,
      })
    } else {
      const trend = analysis.satisfaction > (existing.notes?.match(/(\d+)/)?.[1] ? Number(existing.notes.match(/(\d+)/)![1]) : 70) ? 'improving' : 'declining'
      await supabase.from('crm_contacts').update({
        last_contact_at: email.received_at,
        satisfaction_trend: trend,
        notes: `Predicted satisfaction: ${analysis.satisfaction}`,
      }).eq('id', existing.id)
    }
    setAnalyzing(false)
    showToast('AI analysis complete')
    await loadData()
  }

  const sendReply = async (email: Email) => {
    if (!email.ai_reply_draft) return
    await supabase.from('emails').update({ status: 'replied' }).eq('id', email.id)
    await supabase.from('actions').insert({
      email_id: email.id, type: 'draft_reply', label: 'Reply sent',
      detail: email.ai_reply_draft.slice(0, 120), performed_by: 'user',
    })
    showToast('Reply sent')
    await loadData()
  }

  const escalate = async (email: Email) => {
    await supabase.from('emails').update({ status: 'escalated' }).eq('id', email.id)
    await supabase.from('actions').insert({
      email_id: email.id, type: 'escalate', label: 'Escalated to senior agent',
      detail: email.ai_next_action, performed_by: 'user',
    })
    showToast('Email escalated')
    await loadData()
  }

  const createTask = async (email: Email) => {
    await supabase.from('tasks').insert({
      email_id: email.id,
      title: `Follow up: ${email.subject}`,
      description: email.ai_next_action || email.ai_summary || '',
      priority: email.ai_urgency === 'critical' ? 'high' : 'medium',
      status: 'pending',
    })
    await supabase.from('actions').insert({
      email_id: email.id, type: 'create_task', label: 'Task created',
      detail: `Follow up: ${email.subject}`, performed_by: 'user',
    })
    showToast('Task created')
    await loadData()
  }

  const toggleTask = async (task: Task) => {
    await supabase.from('tasks').update({ status: task.status === 'done' ? 'pending' : 'done' }).eq('id', task.id)
    await loadData()
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    await loadData()
  }

  const addSample = async () => {
    if (!newSample.trim()) return
    await supabase.from('writing_samples').insert({ content: newSample.trim(), tone: style.tone })
    setNewSample('')
    showToast('Writing sample added')
    await loadData()
  }

  const deleteSample = async (id: string) => {
    await supabase.from('writing_samples').delete().eq('id', id)
    await loadData()
  }

  const seedInbox = async () => {
    const seeds = [
      { from_address: 'sarah@brightlabs.io', from_name: 'Sarah Chen', subject: 'URGENT: Refund for duplicate charge', body: 'I am furious right now. I was charged TWICE for my subscription this month and nobody has responded to my previous email. This is completely unacceptable. I need this refunded immediately or I am cancelling my account. This is the worst customer experience I have ever had.', thread_id: 't1' },
      { from_address: 'no-reply@secure-acct-verify.com', from_name: 'Account Security', subject: 'URGENT: Verify your account or it will be terminated', body: 'Dear user, we have detected unusual activity on your account. You must verify your account credentials immediately by clicking this link and entering your password. Failure to do so within 24 hours will result in account termination. This is a security alert. Please download the attached verification form and enable macros.', thread_id: 't2' },
      { from_address: 'mike@northcorp.com', from_name: 'Mike Johnson', subject: 'Question about enterprise pricing', body: 'Hi team, I am wondering about your enterprise tier pricing. We are a company of about 500 people and want to understand what options are available. Could someone reach out with more information? Thanks!', thread_id: 't3' },
      { from_address: 'lisa@designhub.co', from_name: 'Lisa Park', subject: 'Re: Onboarding meeting next week', body: 'Thanks for the great onboarding session yesterday! The team really loved the product demo. Can we schedule a follow-up call for next Tuesday or Wednesday? I am available in the afternoons. Looking forward to it.', thread_id: 't4' },
      { from_address: 'tom@startupx.io', from_name: 'Tom Garcia', subject: 'Bug: Export feature broken', body: 'I am trying to export my dashboard data but I keep getting an error when I click the export button. I have tried clearing my cache. Can someone help me understand what is going wrong? This is confusing because it worked last week.', thread_id: 't5' },
      { from_address: 'jenny@happyclient.com', from_name: 'Jenny Liu', subject: 'Just wanted to say thank you!', body: 'I just wanted to reach out and say how amazing your support team has been. They resolved my issue in under an hour and were so friendly. You guys are doing a wonderful job. I will definitely be recommending your product to everyone I know. Thank you so much!', thread_id: 't6' },
    ]
    const existing = emails.length
    if (existing >= seeds.length) {
      showToast('Inbox already seeded')
      return
    }
    for (const s of seeds) {
      await supabase.from('emails').insert({ ...s, to_address: 'support@ourcompany.com', received_at: new Date(Date.now() - Math.random() * 86400000).toISOString() })
    }
    showToast('Sample emails loaded')
    await loadData()
  }

  const unreadCount = emails.filter((e) => !e.is_read).length
  const openTasks = tasks.filter((t) => t.status !== 'done').length
  const fraudAlerts = emails.filter((e) => (e.ai_fraud_risk ?? 0) >= 50).length

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">AI</div>
            <div>
              <h1>MailMind</h1>
              <p className="brand-sub">AI Email Intelligence Assistant</p>
            </div>
          </div>
          <nav className="nav">
            <button className={view === 'inbox' ? 'on' : ''} onClick={() => setView('inbox')}>
              Inbox{unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
            </button>
            <button className={view === 'tasks' ? 'on' : ''} onClick={() => setView('tasks')}>
              Tasks{openTasks > 0 && <span className="nav-badge warn">{openTasks}</span>}
            </button>
            <button className={view === 'crm' ? 'on' : ''} onClick={() => setView('crm')}>CRM</button>
            <button className={view === 'style' ? 'on' : ''} onClick={() => setView('style')}>Style</button>
          </nav>
        </div>
      </header>

      {fraudAlerts > 0 && (
        <div className="fraud-banner">
          <span className="fraud-icon">!</span>
          {fraudAlerts} fraudulent email{fraudAlerts > 1 ? 's' : ''} detected — review before responding.
        </div>
      )}

      <main className="main">
        {loading ? (
          <div className="loading">Loading…</div>
        ) : view === 'inbox' ? (
          <div className="inbox-layout">
            <div className="email-list">
              <div className="list-head">
                <h2>Inbox</h2>
                {emails.length === 0 && <button className="btn-primary" onClick={seedInbox}>Load sample emails</button>}
              </div>
              {emails.length === 0 ? (
                <div className="empty-state">
                  <p>Your inbox is empty. Load sample emails to see the AI assistant in action.</p>
                </div>
              ) : (
                emails.map((email) => (
                  <button
                    key={email.id}
                    className={`email-item ${selectedId === email.id ? 'sel' : ''} ${!email.is_read ? 'unread' : ''}`}
                    onClick={() => setSelectedId(email.id)}
                  >
                    <div className="email-item-top">
                      <span className="email-from">{email.from_name || email.from_address}</span>
                      <span className="email-time">{timeAgo(email.received_at)}</span>
                    </div>
                    <div className="email-subject">{email.subject}</div>
                    <div className="email-preview">{email.body.slice(0, 80)}…</div>
                    {email.ai_intent && (
                      <div className="email-chips">
                        <Chip label={email.ai_intent} color={intentColor[email.ai_intent] || '#64748b'} />
                        {email.ai_urgency && <Chip label={email.ai_urgency} color={urgencyColor[email.ai_urgency] || '#64748b'} />}
                        {(email.ai_fraud_risk ?? 0) >= 50 && <Chip label="fraud" color="#dc2626" value={`${email.ai_fraud_risk}%`} />}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="email-detail">
              {selected ? (
                <>
                  <div className="detail-head">
                    <h2>{selected.subject}</h2>
                    <div className="detail-meta">
                      <span>From: <strong>{selected.from_name || ''} {`<${selected.from_address}>`}</strong></span>
                      <span>{timeAgo(selected.received_at)}</span>
                    </div>
                  </div>
                  <div className="email-body">{selected.body}</div>

                  {!selected.ai_intent ? (
                    <div className="ai-panel">
                      <div className="ai-panel-head">
                        <h3>AI Analysis</h3>
                        <button className="btn-primary" onClick={() => runAnalysis(selected)} disabled={analyzing}>
                          {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
                        </button>
                      </div>
                      <p className="ai-hint">The assistant will detect intent, emotion, urgency, fraud risk, predict satisfaction, summarize the thread, recommend a next action, and draft a reply in your company's writing style.</p>
                    </div>
                  ) : (
                    <div className="ai-panel analyzed">
                      <div className="ai-panel-head">
                        <h3>AI Analysis</h3>
                        <span className="ai-done">Completed</span>
                      </div>

                      <div className="ai-grid">
                        <div className="ai-card">
                          <span className="ai-label">Intent</span>
                          <Chip label={selected.ai_intent!} color={intentColor[selected.ai_intent!] || '#64748b'} />
                        </div>
                        <div className="ai-card">
                          <span className="ai-label">Emotion</span>
                          <Chip label={selected.ai_emotion!} color={emotionColor[selected.ai_emotion!] || '#64748b'} value={`${selected.ai_emotion_score}%`} />
                        </div>
                        <div className="ai-card">
                          <span className="ai-label">Urgency</span>
                          <Chip label={selected.ai_urgency!} color={urgencyColor[selected.ai_urgency!] || '#64748b'} />
                        </div>
                        <div className="ai-card">
                          <span className="ai-label">Fraud Risk</span>
                          <div className="ai-score-row">
                            <ScoreBar value={selected.ai_fraud_risk ?? 0} color={selected.ai_fraud_risk! >= 50 ? '#dc2626' : '#22c55e'} />
                            <span>{selected.ai_fraud_risk}%</span>
                          </div>
                        </div>
                        <div className="ai-card">
                          <span className="ai-label">Predicted Satisfaction</span>
                          <div className="ai-score-row">
                            <ScoreBar value={selected.ai_satisfaction ?? 0} color={selected.ai_satisfaction! >= 60 ? '#22c55e' : '#f59e0b'} />
                            <span>{selected.ai_satisfaction}%</span>
                          </div>
                        </div>
                      </div>

                      {selected.ai_fraud_flags && selected.ai_fraud_flags.length > 0 && (
                        <div className="fraud-flags">
                          <strong>Fraud indicators:</strong>
                          <ul>{selected.ai_fraud_flags.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                      )}

                      <div className="ai-section">
                        <span className="ai-label">Thread Summary</span>
                        <p>{selected.ai_summary}</p>
                      </div>
                      <div className="ai-section">
                        <span className="ai-label">Recommended Next Action</span>
                        <p>{selected.ai_next_action}</p>
                      </div>

                      <div className="ai-section">
                        <div className="ai-section-head">
                          <span className="ai-label">Drafted Reply (matches your style)</span>
                          <button className="btn-ghost" onClick={() => runAnalysis(selected)} disabled={analyzing}>Regenerate</button>
                        </div>
                        <textarea className="reply-box" defaultValue={selected.ai_reply_draft || ''} rows={7} />
                      </div>

                      <div className="action-bar">
                        <button className="btn-primary" onClick={() => sendReply(selected)}>Send Reply</button>
                        <button className="btn-secondary" onClick={() => createTask(selected)}>Create Task</button>
                        <button className="btn-danger" onClick={() => escalate(selected)}>Escalate</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <h3>Select an email</h3>
                  <p>Choose a message from the inbox to view its content and run AI analysis.</p>
                </div>
              )}
            </div>
          </div>
        ) : view === 'tasks' ? (
          <div className="card-view">
            <h2>Tasks</h2>
            {tasks.length === 0 ? (
              <div className="empty-state"><p>No tasks yet. Tasks are created automatically for urgent emails, or manually from an email's action bar.</p></div>
            ) : (
              <div className="task-list">
                {tasks.map((task) => (
                  <div key={task.id} className={`task-item ${task.status === 'done' ? 'done' : ''}`}>
                    <button className="task-check" onClick={() => toggleTask(task)}>{task.status === 'done' ? '✓' : ''}</button>
                    <div className="task-body">
                      <div className="task-title">{task.title}</div>
                      {task.description && <div className="task-desc">{task.description}</div>}
                      <div className="task-meta">
                        <Chip label={task.priority} color={task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#22c55e'} />
                        <span className="task-date">{timeAgo(task.created_at)}</span>
                      </div>
                    </div>
                    <button className="task-del" onClick={() => deleteTask(task.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : view === 'crm' ? (
          <div className="card-view">
            <h2>CRM Contacts</h2>
            {crm.length === 0 ? (
              <div className="empty-state"><p>No contacts yet. Contacts are created automatically when the AI analyzes an incoming email.</p></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Tier</th><th>Status</th><th>Satisfaction</th><th>Last Contact</th></tr></thead>
                  <tbody>
                    {crm.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name || '—'}</td>
                        <td>{c.email}</td>
                        <td><Chip label={c.tier} color={c.tier === 'enterprise' ? '#8b5cf6' : c.tier === 'pro' ? '#0ea5e9' : '#64748b'} /></td>
                        <td><Chip label={c.status} color={c.status === 'active' ? '#22c55e' : c.status === 'churned' ? '#ef4444' : '#f59e0b'} /></td>
                        <td><Chip label={c.satisfaction_trend || '—'} color={c.satisfaction_trend === 'improving' ? '#22c55e' : c.satisfaction_trend === 'declining' ? '#ef4444' : '#64748b'} /></td>
                        <td>{c.last_contact_at ? timeAgo(c.last_contact_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="card-view">
            <h2>Writing Style</h2>
            <p className="view-desc">The assistant learns your company's voice from approved reply samples and applies it when drafting replies. Add examples of how your team writes.</p>
            <div className="style-controls">
              <label>
                <span>Tone</span>
                <select value={style.tone} onChange={(e) => setStyle({ ...style, tone: e.target.value })}>
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                  <option value="concise">Concise</option>
                </select>
              </label>
              <label>
                <span>Signature</span>
                <input value={style.signature} onChange={(e) => setStyle({ ...style, signature: e.target.value })} />
              </label>
            </div>
            <div className="sample-add">
              <textarea
                placeholder="Paste an example reply your team would send…"
                value={newSample}
                onChange={(e) => setNewSample(e.target.value)}
                rows={4}
              />
              <button className="btn-primary" onClick={addSample}>Add Sample</button>
            </div>
            <div className="sample-list">
              <h3>Saved Samples ({samples.length})</h3>
              {samples.length === 0 ? (
                <p className="muted">No samples yet. Add one above to teach the assistant your style.</p>
              ) : (
                samples.map((s) => (
                  <div key={s.id} className="sample-item">
                    <p>{s.content}</p>
                    <div className="sample-meta">
                      <Chip label={s.tone} color="#0ea5e9" />
                      <button className="task-del" onClick={() => deleteSample(s.id)}>Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}

      <footer className="footer">
        <p>MailGuard · Read · Understand intent · Draft replies · Create tasks · Schedule · Update CRM · Escalate · Detect emotion · Flag fraud · Summarize · Predict satisfaction · Next best action · Learn style</p>
      </footer>
    </div>
  )
}
