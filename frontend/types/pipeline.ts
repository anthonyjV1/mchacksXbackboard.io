// types/pipeline.ts

// ============================================
// CONDITION BLOCK TYPES
// ============================================
export type ConditionBlockType = 
  | 'condition-email-received'
  | 'condition-no-response'
  | 'condition-payment-failed'
  | 'condition-payment-success'
  | 'condition-subscription-cancelled'
  | 'condition-trial-ending'
  | 'condition-high-usage'
  | 'condition-support-ticket'
  | 'condition-new-signup'
  | 'condition-inactive-user'
  | 'condition-order-placed'
  | 'condition-review-received'
  | 'condition-meeting-scheduled'
  | 'condition-form-submitted'
  | 'condition-scheduled-trigger';

// ============================================
// ACTION BLOCK TYPES
// ============================================
export type ActionBlockType = 
  | 'action-send-email'
  | 'action-reply-email'
  | 'action-send-invoice'
  | 'action-resend-invoice'
  | 'action-alert-team'
  | 'action-schedule-followup'
  | 'action-create-task'
  | 'action-update-crm'
  | 'action-apply-discount'
  | 'action-pause-subscription'
  | 'action-cancel-subscription'
  | 'action-send-sms'
  | 'action-log-activity'
  | 'action-webhook'
  | 'action-wait';

// ============================================
// INTEGRATION BLOCK TYPES
// ============================================
export type IntegrationBlockType = 
  | 'integration-stripe'
  | 'integration-slack'
  | 'integration-gmail'
  | 'integration-outlook'
  | 'integration-calendar'
  | 'integration-salesforce'
  | 'integration-hubspot'
  | 'integration-shopify'
  | 'integration-twilio'
  | 'integration-github'
  | 'integration-notion'
  | 'integration-database'
  | 'integration-analytics';

// ============================================
// REFERENCE BLOCK TYPES
// ============================================
export type ReferenceBlockType = 
  | 'reference-note'
  | 'reference-checkpoint'
  | 'reference-custom';

// ============================================
// ALL BLOCK TYPES
// ============================================
export type BlockType = 
  | ConditionBlockType
  | ActionBlockType
  | IntegrationBlockType
  | ReferenceBlockType;

// ============================================
// SPECIAL SYSTEM BLOCKS
// ============================================
export type SystemBlockType = 'condition-end-marker' | 'placeholder';

// ============================================
// BLOCK DATA INTERFACE
// ============================================
export interface BlockData {
  id: string;
  type: BlockType | SystemBlockType;
  title: string;
  description?: string;
  isSystemGenerated?: boolean;
  parentConditionId?: string;
  indentLevel?: number;
  position?: number;
}

// ============================================
// PIPELINE STATE
// ============================================
export interface PipelineState {
  blocks: BlockData[];
  zoom: number;
  offset: { x: number; y: number };
}

// ============================================
// HELPER TYPE GUARDS
// ============================================
export function isConditionBlock(type: string): type is ConditionBlockType {
  return type.startsWith('condition-') && type !== 'condition-end-marker';
}

export function isActionBlock(type: string): type is ActionBlockType {
  return type.startsWith('action-');
}

export function isIntegrationBlock(type: string): type is IntegrationBlockType {
  return type.startsWith('integration-');
}

export function isReferenceBlock(type: string): type is ReferenceBlockType {
  return type.startsWith('reference-');
}

export function isSystemBlock(type: string): type is SystemBlockType {
  return type === 'condition-end-marker';
}
