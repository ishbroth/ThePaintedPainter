// The standard contract between a customer and the painter who confirmed their job.
//
// This file only BUILDS the contract text from what we know about the job and the painter. It has no database or Deno calls, so the seed
// script can use it too. The text is stored with each version when it is sent, so what the customer accepted can never change afterwards.
//
// IMPORTANT: this is a template. It has not been reviewed by a lawyer. Have an attorney review the wording (especially the marketplace
// disclosures, the indemnification, the deposit and cancellation terms, and the electronic-signature clause) before relying on it.
//
// The Painted Painter is a marketplace and not a contractor. The "Marketplace Disclosures" and "Indemnification" sections are always
// part of the contract and take priority over anything in a painter's own attached document.

import { painterBreakdown } from './priceBreakdown.ts'

/** Bump when the standard wording changes; stored with every version so old contracts stay traceable. */
export const CONTRACT_TEXT_VERSION = '2026-10-27'

export interface ChangeOrder {
  description: string
  amount: number
}

/** What the painter adds on top of the standard contract. */
export interface PainterTerms {
  scopeNotes?: string
  specialTerms?: string
  warranty?: string
  changeOrders?: ChangeOrder[]
}

export interface ContractJob {
  id: string
  phase_label: string | null
  customer_name: string | null
  customer_city: string | null
  customer_state: string | null
  quote_zip: string | null
  guaranteed_price: number | null
  deposit_amount: number | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  estimated_days: number | null
  project_summary: unknown
}

export interface ContractPainter {
  company_name: string
  has_license: boolean | null
  license_state: string | null
  is_insured: boolean | null
  is_bonded: boolean | null
  offers_warranty: boolean | null
  warranty_length: string | null
}

export interface Section {
  heading: string
  paragraphs: string[]
}

export interface ContractTerms {
  textVersion: string
  customerFirstName: string
  painterCompany: string
  project: { label: string; city: string | null; state: string | null; zip: string | null; scope: { question: string; answer: string }[]; customerWords: string[] }
  price: { lines: { description: string; amount: number }[]; base: number; deposit: number }
  schedule: { start: string | null; end: string | null; estimatedDays: number | null }
  sections: Section[]
}

export const money = (n: number): string =>
  `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })}`

const longDate = (iso: string | null): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** Cleaned change orders (a description and a non-zero amount), so nothing odd reaches the contract. */
export function cleanChangeOrders(input: unknown): ChangeOrder[] {
  if (!Array.isArray(input)) return []
  const out: ChangeOrder[] = []
  for (const item of input.slice(0, 40)) {
    const description = typeof item?.description === 'string' ? item.description.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
    const amount = Number(item?.amount)
    if (!description || !isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000) continue
    out.push({ description, amount: Math.round(amount * 100) / 100 })
  }
  return out
}

export function cleanPainterTerms(input: unknown): PainterTerms {
  const raw = (input ?? {}) as Record<string, unknown>
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  return {
    scopeNotes: text(raw.scopeNotes, 4000),
    specialTerms: text(raw.specialTerms, 6000),
    warranty: text(raw.warranty, 1500),
    changeOrders: cleanChangeOrders(raw.changeOrders),
  }
}

/** Contract price: the base price plus every change order, with the deposit already paid and what is left to pay the painter. */
export function contractTotals(terms: { price: { base: number; deposit: number } }, painterTerms: PainterTerms) {
  const changes = (painterTerms.changeOrders ?? []).reduce((sum, c) => sum + c.amount, 0)
  const total = Math.round((terms.price.base + changes) * 100) / 100
  const deposit = terms.price.deposit
  return { base: terms.price.base, changes: Math.round(changes * 100) / 100, total, deposit, balance: Math.round((total - deposit) * 100) / 100 }
}

/** The itemized price the customer saw, scaled so the lines add up to the customer's price exactly. */
function priceLines(job: ContractJob): { description: string; amount: number }[] {
  const total = Number(job.guaranteed_price) || 0
  const raw = (job.project_summary as { breakdown?: unknown } | null)?.breakdown
  const lines = painterBreakdown(raw, total).filter((l) => !l.removed).map((l) => ({ description: l.description, amount: l.amount }))
  return lines.length > 0 ? lines : [{ description: job.phase_label || 'Painting services as described in this agreement', amount: total }]
}

export function buildTerms(input: { job: ContractJob; painter: ContractPainter; painterTerms: PainterTerms; documentName?: string | null }): ContractTerms {
  const { job, painter, painterTerms } = input
  const summary = (job.project_summary ?? {}) as { qa?: { question?: string; answer?: string }[]; conversation?: string[] }
  const scope = (summary.qa ?? [])
    .filter((q) => q?.question && q?.answer)
    .slice(0, 40)
    .map((q) => ({ question: String(q.question).slice(0, 200), answer: String(q.answer).slice(0, 400) }))
  const customerWords = (summary.conversation ?? []).filter((l) => typeof l === 'string' && l.trim()).slice(0, 15).map((l) => String(l).trim().slice(0, 400))

  const lines = priceLines(job)
  const base = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100
  const deposit = Number(job.deposit_amount) || Math.round(base * 0.1 * 100) / 100
  const first = String(job.customer_name ?? '').trim().split(/\s+/)[0] || 'the Customer'
  const label = job.phase_label || 'Painting project'
  const company = painter.company_name
  const totals = contractTotals({ price: { base, deposit } }, painterTerms)

  const credentials = [
    painter.has_license ? `holds a contractor license${painter.license_state ? ` in ${painter.license_state}` : ''}` : null,
    painter.is_insured ? 'carries liability insurance' : null,
    painter.is_bonded ? 'is bonded' : null,
  ].filter(Boolean) as string[]

  const start = job.scheduled_date
  const end = job.scheduled_end_date
  const sections: Section[] = []

  sections.push({
    heading: '1. The Parties',
    paragraphs: [
      `This Painting Services Agreement (the “Agreement”) is made between the customer named in the signature below (“Customer”) and ${company} (“Painter”), an independent painting business, for the project described below. It becomes effective when the Customer accepts it electronically.`,
      credentials.length > 0
        ? `Painter has told The Painted Painter that it ${credentials.length > 1 ? `${credentials.slice(0, -1).join(', ')} and ${credentials[credentials.length - 1]}` : credentials[0]}. Painter confirms those statements are true and will keep them true while the work is performed.`
        : 'Painter confirms that it will perform the work in compliance with the licensing and insurance laws that apply where the work is done.',
    ],
  })

  const scopeParagraphs = [`The work is the “${label}” project at the Customer's property${job.customer_city ? ` in ${job.customer_city}${job.customer_state ? `, ${job.customer_state}` : ''}` : ''}, as described by the Customer when requesting their price.`]
  for (const q of scope) scopeParagraphs.push(`${q.question} ${q.answer}`)
  if (customerWords.length > 0) scopeParagraphs.push(`In the Customer's own words: ${customerWords.map((w) => `“${w}”`).join(' ')}`)
  if (painterTerms.scopeNotes) scopeParagraphs.push(`Additional scope notes from Painter: ${painterTerms.scopeNotes}`)
  scopeParagraphs.push('Surface preparation, priming, materials, application and cleanup needed to complete that work to a professional standard are included in the price unless this Agreement says otherwise. Anything not described here is not included.')
  sections.push({ heading: '2. Scope of Work', paragraphs: scopeParagraphs })

  const priceParagraphs = [
    ...lines.map((l) => `${l.description}: ${money(l.amount)}`),
    ...(painterTerms.changeOrders ?? []).map((c) => `Change (${c.description}): ${c.amount < 0 ? '-' : ''}${money(Math.abs(c.amount))}`),
    `Contract price: ${money(totals.total)}.`,
    `Deposit: ${money(deposit)} (10% of the original price) is paid by the Customer through The Painted Painter's payment processor to secure this booking, and is credited toward the contract price.`,
    `Balance: ${money(totals.balance)} is paid by the Customer directly to Painter when the work is complete, unless the Customer and Painter agree otherwise in writing. Any additional amount from an accepted change order is paid to Painter directly as well.`,
  ]
  sections.push({ heading: '3. Price and Payment', paragraphs: priceParagraphs })

  const scheduleParagraphs: string[] = []
  if (start) {
    scheduleParagraphs.push(`Work is scheduled to begin on ${longDate(start)}${end && end !== start ? ` and to be completed by ${longDate(end)}` : ''}.`)
  } else {
    scheduleParagraphs.push('The start and completion dates are the ones agreed between Customer and Painter on The Painted Painter and shown in each party\'s project dashboard.')
  }
  if (job.estimated_days) scheduleParagraphs.push(`Painter's estimate for the work on site is about ${job.estimated_days} working day${job.estimated_days === 1 ? '' : 's'}.`)
  scheduleParagraphs.push('Dates may move for weather (exterior work), delays in Customer providing access, unforeseen conditions found once work begins, or events outside Painter\'s control. Painter will tell the Customer promptly and the parties will agree a new date.')
  sections.push({ heading: '4. Schedule', paragraphs: scheduleParagraphs })

  sections.push({
    heading: '5. Changes and Change Orders',
    paragraphs: [
      'Any change to the scope, price or schedule must be made in writing through the contract page in each party\'s dashboard on The Painted Painter. Painter prepares the change (what, the price difference and any date change) and sends it to the Customer. A change becomes part of this Agreement only when the Customer accepts it there. Until then, the last accepted version of this Agreement stays in force.',
      'Painter will not charge for extra work the Customer has not accepted in writing. If unforeseen conditions (for example rot, damaged surfaces or hidden repairs) require extra work, Painter will propose a change before doing it.',
    ],
  })

  sections.push({
    heading: '6. Painter\'s Responsibilities',
    paragraphs: [
      'Painter is solely responsible for performing the work and for everything that goes with it: supervising and paying its workers and any subcontractors, supplying labor, equipment and materials, protecting the Customer\'s property, complying with all laws and permit requirements (including lead-safe work practices in homes built before 1978), site safety, cleanup, and fixing defects in its work.',
      'Painter will use workers who are qualified for the work, will complete the work in a good and workmanlike manner, and will use the paint brand, grade and finish agreed with the Customer or, where the Customer left it to Painter, a quality product suited to each surface.',
    ],
  })

  sections.push({
    heading: '7. Customer\'s Responsibilities',
    paragraphs: [
      'Customer will give Painter safe access to the work areas on the scheduled dates, clear or allow Painter to move furniture and belongings, provide water and electricity, and secure pets.',
      'Customer will tell Painter before work begins about anything affecting the work that Customer knows of, such as lead paint, asbestos, mold, water damage, structural problems or surfaces that are not Customer\'s to have painted.',
    ],
  })

  const warrantyParagraphs: string[] = []
  if (painterTerms.warranty) warrantyParagraphs.push(painterTerms.warranty)
  else if (painter.offers_warranty) warrantyParagraphs.push(`Painter warrants its workmanship${painter.warranty_length ? ` for ${painter.warranty_length}` : ''} from completion, and will correct defects in its work, such as peeling or blistering caused by the application, at no charge during that period.`)
  else warrantyParagraphs.push('Painter will correct defects in its own workmanship reported to it within a reasonable time after completion, at no charge. Normal wear, damage by others and problems caused by existing surface conditions are not defects in Painter\'s work.')
  sections.push({ heading: '8. Warranty and Touch-Ups', paragraphs: warrantyParagraphs })

  sections.push({
    heading: '9. Marketplace Disclosures',
    paragraphs: [
      'The Painted Painter is an online marketplace that introduces customers to independent painting businesses. The Painted Painter is not a contractor and does not perform, supervise, direct or control any painting work, and it is not a party to this Agreement. No contract for painting services is formed between the Customer and The Painted Painter.',
      `This Agreement is solely between the Customer and ${company}. Painter is an independent business, not an employee, agent or partner of The Painted Painter. Painter alone is responsible for all contracting responsibilities and for the work, including its quality, schedule, licensing, insurance, permits, safety, materials, workers, taxes, change orders and incidentals, and for resolving any problem, warranty claim, dispute or refund request about the work. The Customer will look to Painter, and not to The Painted Painter, for all of these.`,
      'The Painted Painter makes no promise or warranty about the work or about Painter, and its role is limited to introducing the parties, providing this contract page and processing the deposit. Reviews and ratings on the site are opinions of customers.',
    ],
  })

  sections.push({
    heading: '10. Indemnification and Release',
    paragraphs: [
      'Painter will indemnify, defend and hold harmless The Painted Painter and its owners, officers, employees, contractors and affiliates from and against all claims, demands, losses, damages, liabilities, liens, costs and expenses (including reasonable attorneys\' fees) arising out of or related to the work, this Agreement, Painter\'s workers or subcontractors, any injury, death or property damage connected with the work, any violation of law by Painter, or Painter\'s breach of this Agreement.',
      'To the fullest extent the law allows, Customer releases The Painted Painter and its owners, officers and employees from any claim arising out of the work or Painter\'s acts or omissions, and agrees to pursue any such claim against Painter only.',
    ],
  })

  sections.push({
    heading: '11. Deposit, Cancellation and Disputes',
    paragraphs: [
      'The deposit is handled as described in The Painted Painter\'s terms of service. Before work begins, either party may cancel by written notice through the contract page; the deposit is then handled under those terms and the law that applies where the work is done. After work begins, cancellation and any pay-for-work-done questions are between Customer and Painter.',
      'The parties will try in good faith to resolve any dispute directly first. This Agreement is governed by the law of the state where the property is located, and any dispute that is not resolved will be heard in the courts there.',
    ],
  })

  if (painterTerms.specialTerms) sections.push({ heading: '12. Additional Terms from Painter', paragraphs: [painterTerms.specialTerms] })

  const docNumber = painterTerms.specialTerms ? 13 : 12
  if (input.documentName) {
    sections.push({
      heading: `${docNumber}. Painter's Own Contract Document`,
      paragraphs: [
        `Painter has attached its own contract document (“${input.documentName}”). By accepting this Agreement, Customer also accepts that document. If it conflicts with the Marketplace Disclosures or the Indemnification and Release above, those sections control; for everything else about the work itself, whichever is more specific controls.`,
      ],
    })
  }

  sections.push({
    heading: `${docNumber + (input.documentName ? 1 : 0)}. Electronic Signature and Records`,
    paragraphs: [
      'Customer agrees to sign and receive this Agreement and any change to it electronically. Typing a name and selecting “I accept” is Customer\'s legal signature. Each accepted version, the time it was accepted and the Customer\'s name are kept on The Painted Painter and are available to both parties from their dashboards. Either party can print or save a copy at any time.',
      'This Agreement, any accepted changes and any attached Painter document are the whole agreement between Customer and Painter about this work.',
    ],
  })

  return {
    textVersion: CONTRACT_TEXT_VERSION,
    customerFirstName: first,
    painterCompany: company,
    project: { label, city: job.customer_city, state: job.customer_state, zip: job.quote_zip, scope, customerWords },
    price: { lines, base, deposit },
    schedule: { start, end, estimatedDays: job.estimated_days },
    sections,
  }
}
