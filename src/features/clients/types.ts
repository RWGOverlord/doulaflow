// src/features/clients/types.ts
import { z } from 'zod';

export const SERVICE_TYPES = [
  'birth',
  'postpartum',
  'lactation',
  'education',
] as const;

export type ServiceType = typeof SERVICE_TYPES[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  birth:      'Birth Doula',
  postpartum: 'Postpartum Doula',
  lactation:  'Lactation Support',
  education:  'Education',
};

export const CLIENT_STATUSES = [
  'Onboarding',
  'Active',
  'On Call',
  'In Labor',
  'Postpartum',
  'Completed',
  'Inactive',
] as const;

export type ClientStatus = typeof CLIENT_STATUSES[number];

// ─── Form schema ──────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  name:             z.string().min(1, 'Name is required'),
  invited_email:    z.string().email('Invalid email').or(z.literal('')).optional(),
  partner_name:     z.string().optional(),
  phone:            z.string().optional(),
  address_city:     z.string().optional(),
  status:           z.string().min(1).default('Onboarding'),
  service_types:    z.array(z.string()).default([]),
  due_date:         z.string().optional(),
  lmp:              z.string().optional(),
  pregnancy_stage:  z.string().optional(),
  risk_notes:       z.string().optional(),
  notes:            z.string().optional(),
  package_id:       z.string().uuid().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;