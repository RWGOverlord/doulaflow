import jsPDF from 'jspdf';
import type { IntakeFormData } from '../api/intake.api';

// ─── Layout ───────────────────────────────────────────────────────────────────

const PW     = 215.9;        // US Letter width (mm)
const PH     = 279.4;        // US Letter height (mm)
const ML     = 20;           // left/right margin
const CW     = PW - ML * 2;  // content width
const MAX_Y  = PH - 20;      // lowest y before a new page
const FOOT_Y = PH - 10;      // page-number baseline

const FS_TITLE   = 16;
const FS_SUBHEAD = 9;
const FS_SECTION = 10.5;
const FS_FIELD   = 8.5;

const LH_TITLE   = 8;    // line-height for title
const LH_SECTION = 6.5;  // line-height for section heading
const LH_FIELD   = 5.2;  // line-height for body text
const GAP_AFTER_RULE   = 3.5; // gap between section rule and first field
const GAP_AFTER_SECTION = 6;  // gap after last field in a section

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateIntakePdf(data: IntakeFormData, clientName: string): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  let y = ML;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function guard(needed: number) {
    if (y + needed > MAX_Y) {
      doc.addPage();
      y = ML;
    }
  }

  function drawSection(title: string) {
    guard(LH_SECTION + GAP_AFTER_RULE + LH_FIELD * 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS_SECTION);
    doc.setTextColor(30, 30, 30);
    doc.text(title, ML, y);
    y += 2.5;

    doc.setDrawColor(190, 190, 190);
    doc.line(ML, y, PW - ML, y);
    y += GAP_AFTER_RULE;
  }

  function drawField(label: string, value: string | undefined | null) {
    const v    = (value ?? '').trim() || '—';
    const lbl  = label + ': ';

    doc.setFontSize(FS_FIELD);
    doc.setFont('helvetica', 'bold');
    const lblW = doc.getTextWidth(lbl);

    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(v, CW - lblW) as string[];

    if (lines.length === 1) {
      // ── Single line: label + value inline ─────────────────────────────────
      guard(LH_FIELD + 1.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(90, 90, 90);
      doc.text(lbl, ML, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20, 20, 20);
      doc.text(lines[0], ML + lblW, y);

      y += LH_FIELD + 1.5;
    } else {
      // ── Multi-line: bold label row, then wrapped value indented below ──────
      guard(LH_FIELD);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(90, 90, 90);
      doc.text(lbl, ML, y);
      y += LH_FIELD;

      for (const line of lines) {
        guard(LH_FIELD);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20, 20, 20);
        doc.text(line, ML + 4, y);
        y += LH_FIELD;
      }
      y += 1;
    }
  }

  // ── Title block ────────────────────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS_TITLE);
  doc.setTextColor(20, 20, 20);
  doc.text('La Quintana Doula Care — New Client Intake Form', PW / 2, y, { align: 'center' });
  y += LH_TITLE;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS_SUBHEAD);
  doc.setTextColor(110, 110, 110);
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.text(`Submitted by ${clientName} on ${date}`, PW / 2, y, { align: 'center' });
  y += LH_FIELD + 3;

  doc.setDrawColor(200, 200, 200);
  doc.line(ML, y, PW - ML, y);
  y += LH_SECTION;

  // ── Section 1 — Contact Information ───────────────────────────────────────

  drawSection('1. Contact Information');
  drawField('Name',                    data.name);
  drawField('Address',                 data.address);
  drawField('Email',                   data.email);
  drawField('Phone',                   data.phone);
  drawField("Partner's Name",          data.partner_name);
  drawField("Partner's Email",         data.partner_email);
  drawField("Partner's Phone",         data.partner_phone);
  drawField('Preferred Contact Method', data.preferred_contact);
  drawField('Emergency Contact',       data.emergency_contact);
  y += GAP_AFTER_SECTION;

  // ── Section 2 — Care Team ─────────────────────────────────────────────────

  drawSection('2. Care Team');
  drawField('Midwife / OBGYN Name',                   data.provider_name);
  drawField('Delivery Location',                      data.birth_location);
  drawField('Did you choose your provider specifically', data.provider_chosen_specifically);
  drawField('Are you comfortable with your care provider', data.comfortable_with_provider);
  y += GAP_AFTER_SECTION;

  // ── Section 3 — Pregnancy Details ─────────────────────────────────────────

  drawSection('3. Pregnancy Details');
  drawField('Estimated Due Date',                 data.due_date);
  drawField('Expecting Multiples',                data.expecting_multiples);
  drawField("Baby's Gender",                      data.baby_gender);
  drawField("Baby's Name",                        data.baby_name);
  drawField('How Has Your Pregnancy Been',        data.pregnancy_experience);
  drawField('Current Health Conditions',          data.current_health_conditions);
  drawField('Pregnancy Number',                   data.pregnancy_number);
  drawField('Previous Births',                    data.previous_births);
  drawField('Birth Experiences',                  data.birth_experiences);
  drawField('Previous Labor Length',              data.previous_labor_length);
  drawField('Past Pregnancy Health Conditions',   data.past_pregnancy_health_conditions);
  y += GAP_AFTER_SECTION;

  // ── Section 4 — Medical History ───────────────────────────────────────────

  drawSection('4. Medical History');
  drawField('Medical History (allergies, illnesses, medications, etc.)', data.medical_history);
  y += GAP_AFTER_SECTION;

  // ── Section 5 — Birth Preferences ─────────────────────────────────────────

  drawSection('5. Birth Preferences');
  drawField('Birth Preparation',                   data.birth_preparation);
  drawField('Birth Vision',                        data.birth_vision);
  drawField('Has Birth Plan',                      data.has_birth_plan);
  drawField('Shared Preferences with Provider',    data.shared_preferences_with_provider);
  drawField('Provider Knows Doula Will Be Present', data.provider_knows_doula);
  drawField('Early Labor Contact Timing',          data.early_labor_contact_timing);
  drawField('Post-Dates Protocols',                data.post_dates_protocols);
  drawField("Partner's Role at Birth",             data.partner_role_at_birth);
  drawField('Additional Birth Attendees',          data.additional_birth_attendees);
  drawField('People NOT Wanted at Birth',          data.people_not_at_birth);
  y += GAP_AFTER_SECTION;

  // ── Section 6 — Support & Concerns ────────────────────────────────────────

  drawSection('6. Support & Concerns');
  drawField('Fears or Concerns',                         data.fears_or_concerns);
  drawField('Religious / Cultural Beliefs',              data.religious_cultural_beliefs);
  drawField('What Has Been Comforting in Painful Situations', data.comforting_in_pain);
  drawField('How Doula Support Can Help Most',           data.how_doula_helps_most);
  y += GAP_AFTER_SECTION;

  // ── Section 7 — Postpartum ────────────────────────────────────────────────

  drawSection('7. Postpartum');
  drawField('Nursing Experience',          data.nursing_experience);
  drawField('Concerns About Feeding',      data.feeding_concerns);
  drawField('Postpartum Support Available', data.postpartum_support);
  y += GAP_AFTER_SECTION;

  // ── Section 8 — Additional Notes ──────────────────────────────────────────

  drawSection('8. Additional Notes');
  drawField('Any Questions or Anything Else', data.additional_questions);

  // ── Page numbers (added last so total page count is known) ────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text(`Page ${i} of ${totalPages}`, PW / 2, FOOT_Y, { align: 'center' });
  }

  return doc.output('blob');
}
