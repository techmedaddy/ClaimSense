import { z } from 'zod';

/**
 * Core Schema for FNOL (First Notice of Loss)
 * Based on ACORD 2 and Assignment Requirements
 */

export const PolicySchema = z.object({
  policyNumber: z.string().describe("Policy number as shown on the document"),
  policyholderName: z.string().describe("Full name of the insured/policyholder"),
  effectiveDates: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }),
});

export const IncidentSchema = z.object({
  date: z.string().describe("Date of the incident"),
  time: z.string().describe("Time of the incident"),
  location: z.string().describe("Full address or description of where the loss occurred"),
  description: z.string().describe("Narrative description of what happened"),
  authorityContacted: z.string().optional().describe("Police or Fire department name if contacted"),
  reportNumber: z.string().optional().describe("Authority report number"),
});

export const PartySchema = z.object({
  name: z.string(),
  type: z.enum(['Claimant', 'Third Party', 'Witness', 'Insured Driver']),
  contactDetails: z.string().optional(),
  injuries: z.string().optional().describe("Description of injuries if any"),
});

export const AssetSchema = z.object({
  type: z.string().describe("Vehicle, Property, etc."),
  id: z.string().describe("VIN, Plate Number, or Serial Number"),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  estimatedDamage: z.number().optional().describe("Dollar amount if specified"),
});

export const ClaimRoutingSchema = z.enum([
  'FAST_TRACK',
  'MANUAL_REVIEW',
  'INVESTIGATION_FLAG',
  'SPECIALIST_QUEUE'
]);

export const ExtractionResultSchema = z.object({
  policy: PolicySchema,
  incident: IncidentSchema,
  involvedParties: z.array(PartySchema),
  assets: z.array(AssetSchema),
  initialEstimate: z.number().optional(),
  missingMandatoryFields: z.array(z.string()),
});

export const FinalOutputSchema = z.object({
  extractedFields: ExtractionResultSchema,
  missingFields: z.array(z.string()),
  recommendedRoute: ClaimRoutingSchema,
  reasoning: z.string().describe("Detailed explanation for the routing decision"),
});

export type Policy = z.infer<typeof PolicySchema>;
export type Incident = z.infer<typeof IncidentSchema>;
export type Party = z.infer<typeof PartySchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type FinalOutput = z.infer<typeof FinalOutputSchema>;
