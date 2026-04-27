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

// ─── Form schema (used in New Client wizard + Edit) ───────────────────────────

export const clientSchema = z.object({
  name:             z.string().min(1, 'Name is required'),
  invited_email:    z.string().email('Invalid email').nullable().or(z.literal('')),
  partner_name:     z.string().nullable(),
  phone:            z.string().nullable(),
  address_city:     z.string().nullable(),
  status:           z.string().default('Onboarding'),
  service_types:    z.array(z.string()).default([]),
  due_date:         z.string().nullable(),
  lmp:              z.string().nullable(),
  pregnancy_stage:  z.string().nullable(),
  risk_notes:       z.string().nullable(),
  notes:            z.string().nullable(),
  // Package assignment (handled separately via client_packages table)
  package_id:       z.string().uuid().nullable().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;