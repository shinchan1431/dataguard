// Heuristic AI analysis engine for email intelligence.
// Simulates NLP intent/emotion detection, fraud scoring, satisfaction prediction,
// thread summarization, next-best-action recommendation, and style-aware reply drafting.

export type Intent = 'inquiry' | 'complaint' | 'support' | 'billing' | 'meeting_request' | 'fraud' | 'praise' | 'other'
export type Emotion = 'positive' | 'neutral' | 'frustrated' | 'angry' | 'confused' | 'urgent'
export type Urgency = 'low' | 'medium' | 'high' | 'critical'

export interface EmailAnalysis {
  intent: Intent
  emotion: Emotion
  emotionScore: number
  urgency: Urgency
  fraudRisk: number
  fraudFlags: string[]
  spamRisk: number
  spamFlags: string[]
  satisfaction: number
  summary: string
  nextAction: string
  replyDraft: string
}

const FRAUD_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /urgent.{0,30}(transfer|wire|payment|fund)/i, flag: 'Urgent financial transfer request' },
  { pattern: /(gift card|bitcoin|crypto|wallet)/i, flag: 'Unusual payment method requested' },
  { pattern: /(verify your account|confirm your password|update your credentials)/i, flag: 'Credential phishing language' },
  { pattern: /(lottery|winner|inheritance|prince|nigeria)/i, flag: 'Advance-fee scam signature' },
  { pattern: /(invoice|attachment).{0,40}(click|download|enable)/i, flag: 'Suspicious attachment lure' },
  { pattern: /ceo.{0,20}(request|need|asking)/i, flag: 'Impersonation of executive' },
  { pattern: /security alert.{0,40}(suspend|terminate|close)/i, flag: 'Threat-based account intimidation' },
]

const SPAM_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /(free trial|act now|limited time|offer expires|last chance|don't miss out)/i, flag: 'High-pressure marketing language' },
  { pattern: /(weight loss|miracle cure|viagra|casino|betting|gambling|slots)/i, flag: 'Spam-prone product category' },
  { pattern: /(click here|buy now|subscribe now|opt in|opt-out|unsubscribe)/i, flag: 'Bulk marketing call-to-action' },
  { pattern: /(dear friend|dear sir\/madam|dear valued customer)/i, flag: 'Generic mass-mail salutation' },
  { pattern: /(100% free|guaranteed income|work from home|make money|earn money online)/i, flag: 'Get-rich-quick scheme language' },
  { pattern: /(seo services|ranking on google|backlinks|traffic to your website)/i, flag: 'Unsolicited service solicitation' },
  { pattern: /(discount|sale|promotion|deal of the day|clearance)/i, flag: 'Promotional bulk content' },
  { pattern: /(you have been selected|congratulations you|you are a winner)/i, flag: 'Mass-mail prize notification' },
]

const EMOTION_LEXICON: { words: RegExp; emotion: Emotion; weight: number }[] = [
  { words: /(furious|outraged|disgusted|unacceptable|ridiculous|terrible|worst)/i, emotion: 'angry', weight: 35 },
  { words: /(frustrated|annoyed|disappointed|fed up|tired of|not happy)/i, emotion: 'frustrated', weight: 25 },
  { words: /(confused|don't understand|not sure|unclear|lost|help me understand)/i, emotion: 'confused', weight: 20 },
  { words: /(urgent|asap|immediately|right away|emergency|critical)/i, emotion: 'urgent', weight: 30 },
  { words: /(great|excellent|amazing|love|wonderful|fantastic|thank you so much)/i, emotion: 'positive', weight: 30 },
  { words: /(happy|pleased|satisfied|appreciate|grateful|thanks)/i, emotion: 'positive', weight: 18 },
]

const INTENT_PATTERNS: { pattern: RegExp; intent: Intent }[] = [
  { pattern: /(refund|charge|invoice|bill|payment|overcharged|billing)/i, intent: 'billing' },
  { pattern: /(meeting|schedule|call|appointment|calendar|availability)/i, intent: 'meeting_request' },
  { pattern: /(complaint|terrible|unacceptable|worst|angry|disappointed)/i, intent: 'complaint' },
  { pattern: /(praise|amazing|love|wonderful|thank you so much|great job)/i, intent: 'praise' },
  { pattern: /(how do i|help|support|broken|error|bug|can't|cannot|issue)/i, intent: 'support' },
  { pattern: /(question|inquiry|wondering|info|information|details about)/i, intent: 'inquiry' },
  { pattern: /(fraud|scam|phishing|suspicious|hack|compromised)/i, intent: 'fraud' },
]

function detectIntent(text: string): Intent {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(text)) return intent
  }
  return 'other'
}

function detectEmotion(text: string): { emotion: Emotion; score: number } {
  let score = 25
  let topEmotion: Emotion = 'neutral'
  for (const { words, emotion, weight } of EMOTION_LEXICON) {
    if (words.test(text)) {
      score += weight
      if (weight >= 25) topEmotion = emotion
    }
  }
  if (score <= 25) topEmotion = 'neutral'
  return { emotion: topEmotion, score: Math.min(100, score) }
}

function detectUrgency(text: string, emotion: Emotion): Urgency {
  if (/\b(asap|immediately|right away|emergency|today|now)\b/i.test(text)) return 'critical'
  if (emotion === 'angry' || /\b(urgent|critical|deadline)\b/i.test(text)) return 'high'
  if (emotion === 'frustrated' || emotion === 'urgent') return 'medium'
  return 'low'
}

function detectFraud(text: string): { risk: number; flags: string[] } {
  let risk = 0
  const flags: string[] = []
  for (const { pattern, flag } of FRAUD_PATTERNS) {
    if (pattern.test(text)) {
      risk += 28
      flags.push(flag)
    }
  }
  // External sender mismatch heuristic
  if (/(no-reply|donotreply|mailer)/i.test(text)) risk += 8
  return { risk: Math.min(100, risk), flags }
}

function detectSpam(text: string): { risk: number; flags: string[] } {
  let risk = 0
  const flags: string[] = []
  for (const { pattern, flag } of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      risk += 15
      flags.push(flag)
    }
  }
  return { risk: Math.min(100, risk), flags }
}

function predictSatisfaction(emotion: Emotion, emotionScore: number, fraudRisk: number): number {
  let base = 70
  if (emotion === 'positive') base = 88
  if (emotion === 'neutral') base = 65
  if (emotion === 'frustrated') base = 42
  if (emotion === 'confused') base = 50
  if (emotion === 'angry') base = 22
  if (emotion === 'urgent') base = 38
  base += (emotionScore > 50 ? -8 : 5)
  base -= Math.round(fraudRisk * 0.2)
  return Math.max(5, Math.min(100, base))
}

function summarizeThread(subject: string, body: string): string {
  const sentences = body.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.length > 15)
  const top = sentences.slice(0, 2).join(' ')
  const trimmed = top.length > 180 ? top.slice(0, 180) + '…' : top
  return `Re: ${subject}. ${trimmed || 'No substantive content.'}`
}

function nextBestAction(intent: Intent, urgency: Urgency, emotion: Emotion, fraudRisk: number): string {
  if (fraudRisk >= 50) return 'Quarantine email and alert security team — do not engage sender.'
  if (urgency === 'critical') return 'Escalate immediately to a senior agent and respond within 1 hour.'
  if (emotion === 'angry') return 'Prioritize a empathetic response; offer a direct call to de-escalate.'
  if (intent === 'complaint') return 'Acknowledge the issue, apologize, and open a task with a resolution deadline.'
  if (intent === 'billing') return 'Review the account billing history and issue a status update or refund confirmation.'
  if (intent === 'meeting_request') return 'Propose two time slots and create a calendar invite draft.'
  if (intent === 'support') return 'Draft a troubleshooting reply and create a follow-up task if unresolved.'
  if (intent === 'praise') return 'Send a warm thank-you and share with the team; consider a testimonial request.'
  if (intent === 'inquiry') return 'Reply with the relevant information and link to documentation.'
  return 'Draft a brief acknowledgment and route to the appropriate team.'
}

function draftReply(
  intent: Intent,
  emotion: Emotion,
  fromName: string | null,
  subject: string,
  style: { tone: string; signature: string; samples: string[] },
): string {
  const name = fromName ? fromName.split(' ')[0] : 'there'
  const greeting = style.tone === 'formal' ? `Dear ${name},` : style.tone === 'concise' ? `Hi ${name},` : `Hi ${name}!`
  const sign = style.signature || 'Best regards,\nThe Team'

  let body = ''
  if (intent === 'complaint' || emotion === 'angry') {
    body = `Thank you for reaching out — I'm sorry to hear about the trouble you've experienced. That's not the standard we hold ourselves to, and I want to make it right. I've flagged this for priority handling and will follow up with a concrete resolution within 24 hours.`
  } else if (intent === 'billing') {
    body = `Thanks for your note about your billing. I've pulled up your account and I'm looking into the charge you mentioned. I'll confirm the details and get back to you today with either a correction or a clear explanation.`
  } else if (intent === 'meeting_request') {
    body = `I'd be happy to find a time to connect. I have availability this Tuesday at 2:00 PM or Thursday at 10:00 AM (your timezone). If neither works, just let me know what suits you and I'll accommodate.`
  } else if (intent === 'support') {
    body = `Thanks for the details — I understand the issue you're running into. Here's what I'd suggest as a first step: try clearing the cache and retrying, and let me know the exact error message if it persists. I'll stay on this until it's resolved.`
  } else if (intent === 'praise') {
    body = `Thank you so much for the kind words — it genuinely made our day. I'll share your feedback with the team. If you're ever open to it, we'd love to feature your experience as a short testimonial.`
  } else if (intent === 'fraud') {
    body = `Thank you for flagging this. I've escalated it to our security team for immediate review. Please do not click any links in the suspicious message, and we'll follow up with guidance shortly.`
  } else {
    body = `Thanks for reaching out about "${subject}". I've reviewed your message and want to make sure we get you the right answer. I'll follow up shortly with the details you need.`
  }

  // Lightly blend in a sample phrase if available (style learning)
  if (style.samples.length > 0) {
    const sample = style.samples[Math.floor(Math.random() * style.samples.length)]
    const sampleSentence = sample.split(/(?<=[.!?])\s+/)[0]
    if (sampleSentence && sampleSentence.length < 120) {
      body += ` ${sampleSentence}`
    }
  }

  return `${greeting}\n\n${body}\n\n${sign}`
}

export function analyzeEmail(
  subject: string,
  body: string,
  fromName: string | null,
  style: { tone: string; signature: string; samples: string[] },
): EmailAnalysis {
  const text = `${subject}\n${body}`
  const intent = detectIntent(text)
  const { emotion, score } = detectEmotion(text)
  const urgency = detectUrgency(text, emotion)
  const { risk, flags } = detectFraud(text)
  const { risk: spamRisk, flags: spamFlags } = detectSpam(text)
  const satisfaction = predictSatisfaction(emotion, score, risk)
  const summary = summarizeThread(subject, body)
  const nextAction = nextBestAction(intent, urgency, emotion, risk)
  const replyDraft = draftReply(intent, emotion, fromName, subject, style)

  return {
    intent,
    emotion,
    emotionScore: score,
    urgency,
    fraudRisk: risk,
    fraudFlags: flags,
    spamRisk,
    spamFlags,
    satisfaction,
    summary,
    nextAction,
    replyDraft,
  }
}
