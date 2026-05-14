'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { CheckCircle, AlertCircle, Clock, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { generateIntakePdf } from '@/features/intake/lib/generateIntakePdf';
import type { IntakeFormData } from '@/features/intake/api/intake.api';

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenStatus = 'loading' | 'valid' | 'expired' | 'completed' | 'invalid';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

type TokenRow = {
  client_id: string;
  client_name: string;
  expires_at: string;
  completed_at: string | null;
};

// birth_experiences is a string in IntakeFormData (comma-joined) but a string[]
// in the form so checkboxes can manage it naturally
type FormValues = Omit<IntakeFormData, 'birth_experiences'> & {
  birth_experiences_arr: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

const STEP_LABELS = [
  'Contact & Care',
  'Pregnancy',
  'Medical & Birth',
  'Support & Notes',
];

const BIRTH_EXPERIENCE_OPTIONS = [
  'First time birthing person',
  'Previous vaginal birth',
  'Previous C-section',
  'Previous VBAC',
  'Previous loss / stillbirth',
  'Previous premature birth',
];

const CONTACT_OPTIONS = ['Phone call', 'Text message', 'Email', 'Any'];
const YES_NO_UNSURE   = ['Yes', 'No', 'Unsure'];
const YES_NO_NOTYET   = ['Yes', 'No', 'Not yet'];
const BIRTH_PLAN_OPTS = ['Yes', 'No', 'In progress'];
const GENDER_OPTIONS  = ['Boy', 'Girl', 'Not revealing yet', 'Unknown'];

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-stone-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function inputCls(hasError?: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2 text-sm text-stone-900',
    'placeholder:text-stone-400 bg-white',
    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
    hasError ? 'border-red-400' : 'border-stone-300',
  ].join(' ');
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500">{msg}</p>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-4 pb-1 border-b border-stone-100 mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
        {children}
      </h3>
    </div>
  );
}

function SelectField({
  label,
  options,
  required,
  error,
  placeholder,
  ...rest
}: {
  label: string;
  options: string[];
  required?: boolean;
  error?: string;
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <select className={inputCls(!!error)} {...rest}>
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <FieldError msg={error} />
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const num    = i + 1;
        const done   = num < current;
        const active = num === current;
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={[
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold',
                done   ? 'bg-primary text-primary-foreground'          : '',
                active ? 'bg-primary text-primary-foreground ring-4 ring-primary/10' : '',
                !done && !active ? 'bg-stone-200 text-stone-500' : '',
              ].join(' ')}>
                {done ? '✓' : num}
              </div>
              <span className={[
                'text-[10px] font-medium hidden sm:block w-20 text-center leading-tight',
                active ? 'text-primary' : 'text-stone-400',
              ].join(' ')}>
                {label}
              </span>
            </div>
            {i < TOTAL_STEPS - 1 && (
              <div className={[
                'h-0.5 w-8 sm:w-12 mx-1 mb-5',
                done ? 'bg-primary' : 'bg-stone-200',
              ].join(' ')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Status screens ───────────────────────────────────────────────────────────

function StatusCard({
  icon: Icon,
  iconColor,
  title,
  body,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  body: string;
}) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-10 max-w-md w-full text-center">
        <div className={`mx-auto mb-5 h-14 w-14 rounded-full flex items-center justify-center ${iconColor}`}>
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-stone-800 mb-2">{title}</h2>
        <p className="text-sm text-stone-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const params             = useParams<{ token: string }>();
  const token              = params?.token ?? '';
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('loading');
  const [tokenRow, setTokenRow]       = useState<TokenRow | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitError, setSubmitError]   = useState('');
  const [step, setStep] = useState(1);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: '', address: '', email: '', phone: '',
      partner_name: '', partner_email: '', partner_phone: '',
      preferred_contact: '', emergency_contact: '',
      provider_name: '', birth_location: '',
      provider_chosen_specifically: '', comfortable_with_provider: '',
      due_date: '', expecting_multiples: '', baby_gender: '', baby_name: '',
      pregnancy_experience: '', current_health_conditions: '',
      pregnancy_number: '', previous_births: '', birth_experiences_arr: [],
      previous_labor_length: '', past_pregnancy_health_conditions: '',
      medical_history: '',
      birth_preparation: '', birth_vision: '', has_birth_plan: '',
      shared_preferences_with_provider: '', provider_knows_doula: '',
      early_labor_contact_timing: '', post_dates_protocols: '',
      partner_role_at_birth: '', additional_birth_attendees: '', people_not_at_birth: '',
      fears_or_concerns: '', religious_cultural_beliefs: '',
      comforting_in_pain: '', how_doula_helps_most: '',
      nursing_experience: '', feeding_concerns: '', postpartum_support: '',
      additional_questions: '',
    },
  });

  const birthExpArr = watch('birth_experiences_arr') ?? [];

  // ── Load token ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    sb.from('intake_tokens')
      .select('client_id, expires_at, completed_at, clients(name)')
      .eq('token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setTokenStatus('invalid'); return; }
        if (data.completed_at) { setTokenStatus('completed'); return; }
        if (new Date(data.expires_at) < new Date()) { setTokenStatus('expired'); return; }

        setTokenRow({
          client_id:   data.client_id,
          client_name: (data as any).clients?.name ?? 'there',
          expires_at:  data.expires_at,
          completed_at: data.completed_at,
        });
        setTokenStatus('valid');
      });
  }, [token]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    if (!tokenRow) return;
    setSubmitStatus('submitting');
    setSubmitError('');

    try {
      // Build IntakeFormData — join multi-select checkboxes to a string
      const intakeData: IntakeFormData = {
        ...values,
        birth_experiences: values.birth_experiences_arr.join(', '),
      };

      // 1. Generate PDF client-side (jsPDF is browser-only)
      const pdfBlob = generateIntakePdf(intakeData, tokenRow.client_name);

      // 2. Convert blob → base64 for JSON transport
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfBytes       = new Uint8Array(pdfArrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < pdfBytes.length; i += chunkSize) {
        binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
      }
      const pdfBase64 = btoa(binary);

      // 3. Single server call: validate token, update client, upload PDF, mark complete
      const res = await fetch('/api/intake/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, formData: intakeData, pdfBase64 }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Submission failed');
      }

      setSubmitStatus('success');
    } catch (err: unknown) {
      console.error('[intake submit]', err);
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitStatus('error');
    }
  }

  // ── Toggle birth experience checkbox ─────────────────────────────────────────

  function toggleBirthExp(option: string) {
    const current = birthExpArr;
    const next    = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    setValue('birth_experiences_arr', next);
  }

  // ── Render gating ───────────────────────────────────────────────────────────

  if (tokenStatus === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
      </div>
    );
  }

  if (tokenStatus === 'expired') {
    return (
      <StatusCard
        icon={Clock}
        iconColor="bg-amber-100 text-amber-600"
        title="This link has expired"
        body="Intake links are valid for 7 days. Please reach out to your doula to request a new link."
      />
    );
  }

  if (tokenStatus === 'completed') {
    return (
      <StatusCard
        icon={CheckCircle}
        iconColor="bg-green-100 text-green-600"
        title="Form already submitted"
        body="This intake form has already been completed. Thank you! Your doula will be in touch soon."
      />
    );
  }

  if (tokenStatus === 'invalid') {
    return (
      <StatusCard
        icon={AlertCircle}
        iconColor="bg-red-100 text-red-500"
        title="Invalid link"
        body="This link doesn't look right. Please check the link in your email or contact your doula."
      />
    );
  }

  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-10 max-w-md w-full text-center">
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Thank you!</h2>
          <p className="text-stone-600 leading-relaxed">
            Your intake form has been submitted. Megan will be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  const isSubmitting = submitStatus === 'submitting';

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Branding */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            La Quintana Doula Care
          </p>
          <h1 className="text-2xl font-bold text-stone-800">New Client Intake Form</h1>
          {tokenRow && (
            <p className="text-sm text-stone-500 mt-1">
              Welcome, {tokenRow.client_name.split(' ')[0]}!
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">

          {/* Progress */}
          <div className="px-8 pt-8 pb-0">
            <StepIndicator current={step} />
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="px-8 pb-8">

              {/* ── Step 1: Contact & Care ──────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Intro banner */}
                  <div className="rounded-xl bg-primary/5 border border-primary/10 px-5 py-4 text-sm text-primary leading-relaxed">
                    Congratulations on your pregnancy! I am honored to take this journey with you &
                    look forward to learning more about you and your desired birth experience. Please
                    complete the fields below so that we may determine how I can serve you best.{' '}
                    <em>(Feel free to skip any questions you&rsquo;re not sure about &amp; we can
                    talk about it at our next appointment)</em>
                  </div>

                  <SectionHeading>Contact Information</SectionHeading>

                  <div>
                    <Label required>Name (client)</Label>
                    <input
                      className={inputCls(!!errors.name)}
                      placeholder="Full name"
                      {...register('name', { required: 'Name is required' })}
                    />
                    <FieldError msg={errors.name?.message} />
                  </div>

                  <div>
                    <Label required>Address</Label>
                    <textarea
                      className={inputCls(!!errors.address)}
                      rows={2}
                      placeholder="Street, City, State ZIP"
                      {...register('address', { required: 'Address is required' })}
                    />
                    <FieldError msg={errors.address?.message} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label required>Email</Label>
                      <input
                        type="email"
                        className={inputCls(!!errors.email)}
                        placeholder="you@example.com"
                        {...register('email', {
                          required: 'Email is required',
                          pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                        })}
                      />
                      <FieldError msg={errors.email?.message} />
                    </div>
                    <div>
                      <Label required>Phone</Label>
                      <input
                        type="tel"
                        className={inputCls(!!errors.phone)}
                        placeholder="(555) 000-0000"
                        {...register('phone', { required: 'Phone is required' })}
                      />
                      <FieldError msg={errors.phone?.message} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Partner&rsquo;s Name</Label>
                      <input className={inputCls()} placeholder="Full name" {...register('partner_name')} />
                    </div>
                    <div>
                      <Label>Partner&rsquo;s Email</Label>
                      <input type="email" className={inputCls()} placeholder="partner@example.com" {...register('partner_email')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Partner&rsquo;s Phone</Label>
                      <input type="tel" className={inputCls()} placeholder="(555) 000-0000" {...register('partner_phone')} />
                    </div>
                    <div>
                      <SelectField
                        label="Preferred Contact Method"
                        options={CONTACT_OPTIONS}
                        {...register('preferred_contact')}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Emergency Contact</Label>
                    <input
                      className={inputCls()}
                      placeholder="Name & phone number"
                      {...register('emergency_contact')}
                    />
                  </div>

                  <SectionHeading>Care Team</SectionHeading>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Midwife / OBGYN Name</Label>
                      <input className={inputCls()} placeholder="Provider name" {...register('provider_name')} />
                    </div>
                    <div>
                      <Label>Delivery Location</Label>
                      <input className={inputCls()} placeholder="Hospital, birth center, home…" {...register('birth_location')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SelectField
                      label="Did you specifically choose your provider?"
                      options={YES_NO_UNSURE}
                      {...register('provider_chosen_specifically')}
                    />
                    <SelectField
                      label="Are you comfortable with your provider?"
                      options={YES_NO_UNSURE}
                      {...register('comfortable_with_provider')}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 2: Pregnancy Details ───────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-5">
                  <SectionHeading>Pregnancy Details</SectionHeading>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Estimated Due Date</Label>
                      <input type="date" className={inputCls()} {...register('due_date')} />
                    </div>
                    <SelectField
                      label="Expecting Multiples?"
                      options={YES_NO_UNSURE}
                      {...register('expecting_multiples')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SelectField
                      label="Baby's Gender"
                      options={GENDER_OPTIONS}
                      placeholder="Prefer not to say / Unknown"
                      {...register('baby_gender')}
                    />
                    <div>
                      <Label>Baby&rsquo;s Name (if chosen)</Label>
                      <input className={inputCls()} placeholder="Optional" {...register('baby_name')} />
                    </div>
                  </div>

                  <div>
                    <Label>Overall, how has your pregnancy been?</Label>
                    <textarea
                      className={inputCls()}
                      rows={3}
                      placeholder="Tell me about your experience so far…"
                      {...register('pregnancy_experience')}
                    />
                  </div>

                  <div>
                    <Label>Current Health Conditions</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Any conditions related to this pregnancy…"
                      {...register('current_health_conditions')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Pregnancy Number</Label>
                      <input
                        className={inputCls()}
                        placeholder="e.g. 1st, 2nd, 3rd"
                        {...register('pregnancy_number')}
                      />
                    </div>
                    <div>
                      <Label>Number of Previous Births</Label>
                      <input
                        className={inputCls()}
                        placeholder="e.g. 0, 1, 2"
                        {...register('previous_births')}
                      />
                    </div>
                  </div>

                  {/* Multi-select birth experiences */}
                  <div>
                    <Label>Birth Experiences (select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {BIRTH_EXPERIENCE_OPTIONS.map(opt => (
                        <label
                          key={opt}
                          className={[
                            'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer text-sm transition-colors',
                            birthExpArr.includes(opt)
                              ? 'border-primary/40 bg-primary/5 text-primary'
                              : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
                          ].join(' ')}
                        >
                          <input
                            type="checkbox"
                            className="accent-primary h-4 w-4 shrink-0"
                            checked={birthExpArr.includes(opt)}
                            onChange={() => toggleBirthExp(opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Previous Labor Length</Label>
                    <input
                      className={inputCls()}
                      placeholder="e.g. 12 hours, N/A"
                      {...register('previous_labor_length')}
                    />
                  </div>

                  <div>
                    <Label>Past Pregnancy Health Conditions</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Any conditions from previous pregnancies…"
                      {...register('past_pregnancy_health_conditions')}
                    />
                  </div>
                </div>
              )}

              {/* ── Step 3: Medical & Birth Preferences ────────────────────── */}
              {step === 3 && (
                <div className="space-y-5">
                  <SectionHeading>Medical History</SectionHeading>

                  <div>
                    <Label>Medical History</Label>
                    <textarea
                      className={inputCls()}
                      rows={4}
                      placeholder="Allergies, illnesses, current medications, surgeries, anything relevant…"
                      {...register('medical_history')}
                    />
                  </div>

                  <SectionHeading>Birth Preferences</SectionHeading>

                  <div>
                    <Label>Birth Preparation</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Childbirth classes, books, podcasts you've used…"
                      {...register('birth_preparation')}
                    />
                  </div>

                  <div>
                    <Label>Your Birth Vision</Label>
                    <textarea
                      className={inputCls()}
                      rows={3}
                      placeholder="What does your ideal birth experience look like?"
                      {...register('birth_vision')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <SelectField
                      label="Do you have a birth plan?"
                      options={BIRTH_PLAN_OPTS}
                      {...register('has_birth_plan')}
                    />
                    <SelectField
                      label="Shared preferences with provider?"
                      options={YES_NO_NOTYET}
                      {...register('shared_preferences_with_provider')}
                    />
                    <SelectField
                      label="Provider knows doula will be present?"
                      options={YES_NO_NOTYET}
                      {...register('provider_knows_doula')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Early Labor Contact Timing</Label>
                      <input
                        className={inputCls()}
                        placeholder="e.g. contractions 5-1-1, when water breaks"
                        {...register('early_labor_contact_timing')}
                      />
                    </div>
                    <div>
                      <Label>Post-Dates Protocols</Label>
                      <input
                        className={inputCls()}
                        placeholder="Induction plans, preferences…"
                        {...register('post_dates_protocols')}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Partner&rsquo;s Role at Birth</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="How involved do you want your partner to be?"
                      {...register('partner_role_at_birth')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Additional Birth Attendees</Label>
                      <input
                        className={inputCls()}
                        placeholder="Anyone else you'd like present"
                        {...register('additional_birth_attendees')}
                      />
                    </div>
                    <div>
                      <Label>People NOT Wanted at Birth</Label>
                      <input
                        className={inputCls()}
                        placeholder="Anyone you'd prefer not be there"
                        {...register('people_not_at_birth')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Support & Notes ─────────────────────────────────── */}
              {step === 4 && (
                <div className="space-y-5">
                  <SectionHeading>Support &amp; Concerns</SectionHeading>

                  <div>
                    <Label>Fears or Concerns About Birth</Label>
                    <textarea
                      className={inputCls()}
                      rows={3}
                      placeholder="Anything you're worried about or hoping to avoid…"
                      {...register('fears_or_concerns')}
                    />
                  </div>

                  <div>
                    <Label>Religious / Cultural Beliefs or Practices</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Any beliefs or traditions important to you during birth…"
                      {...register('religious_cultural_beliefs')}
                    />
                  </div>

                  <div>
                    <Label>What Has Been Comforting in Painful Situations?</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Touch, music, words of encouragement, being alone, etc."
                      {...register('comforting_in_pain')}
                    />
                  </div>

                  <div>
                    <Label>How Can Doula Support Help You Most?</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Physical support, emotional support, advocacy, information…"
                      {...register('how_doula_helps_most')}
                    />
                  </div>

                  <SectionHeading>Postpartum</SectionHeading>

                  <div>
                    <Label>Nursing / Feeding Experience or Plans</Label>
                    <input
                      className={inputCls()}
                      placeholder="Breastfeeding, formula, combination…"
                      {...register('nursing_experience')}
                    />
                  </div>

                  <div>
                    <Label>Concerns About Feeding</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Any questions or worries about feeding your baby…"
                      {...register('feeding_concerns')}
                    />
                  </div>

                  <div>
                    <Label>Postpartum Support Available</Label>
                    <textarea
                      className={inputCls()}
                      rows={2}
                      placeholder="Partner, family, friends, other support people…"
                      {...register('postpartum_support')}
                    />
                  </div>

                  <SectionHeading>Additional Notes</SectionHeading>

                  <div>
                    <Label>Any Questions or Anything Else You&rsquo;d Like Me to Know?</Label>
                    <textarea
                      className={inputCls()}
                      rows={4}
                      placeholder="Anything at all — no question is too small!"
                      {...register('additional_questions')}
                    />
                  </div>

                  {submitStatus === 'error' && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {submitError || 'Something went wrong. Please try again.'}
                    </div>
                  )}
                </div>
              )}

              {/* ── Navigation ──────────────────────────────────────────────── */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-100">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(s => s - 1)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                ) : (
                  <div />
                )}

                {step < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={() => setStep(s => s + 1)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSubmitting ? 'Submitting…' : 'Submit Form'}
                  </button>
                )}
              </div>

              {/* Step counter */}
              <p className="text-center text-xs text-stone-400 mt-4">
                Step {step} of {TOTAL_STEPS}
              </p>

            </div>
          </form>
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          La Quintana Doula Care · Your information is kept private and secure.
        </p>
      </div>
    </div>
  );
}
