// src/lib/blocks/blockDefinitions.ts
import { 
  Zap, 
  Split, 
  Repeat, 
  Timer, 
  Filter, 
  Mail, 
  Webhook, 
  Database, 
  Calculator, 
  Code2, 
  Users, 
  CreditCard, 
  FileText, 
  ShoppingCart, 
  MessageSquare,
  MailOpen,
  MailX,
  DollarSign,
  AlertCircle,
  UserX,
  Calendar,
  Clock,
  Send,
  Reply,
  ReceiptText,
  Bell,
  CheckCircle,
  XCircle,
  RefreshCw,
  UserPlus,
  Package,
  TrendingUp,
  Activity,
  Star,
  Phone,
  Slack,
  Github,
  BookOpen,
  Eye,
  Pencil
} from 'lucide-react'
import { BlockType } from '../../../types/pipeline'

export interface BlockDefinition {
  type: BlockType
  label: string
  icon: any
  description: string
  category: 'Conditions' | 'Actions' | 'Integrations' | 'Reference'
  gradient: string
  isCondition?: boolean // Special flag for condition blocks
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // ============================================
  // CONDITION BLOCKS (Revenue-Critical Triggers)
  // ============================================
  { 
    type: 'condition-email-received', 
    label: 'Email Received', 
    icon: MailOpen, 
    description: 'When a new email arrives',
    category: 'Conditions',
    gradient: 'from-blue-400 to-blue-600',
    isCondition: true
  },
  { 
    type: 'condition-no-response', 
    label: 'No Email Response', 
    icon: MailX, 
    description: 'When email goes unanswered',
    category: 'Conditions',
    gradient: 'from-orange-400 to-red-500',
    isCondition: true
  },
  { 
    type: 'condition-payment-failed', 
    label: 'Payment Failed', 
    icon: XCircle, 
    description: 'When Stripe payment declines',
    category: 'Conditions',
    gradient: 'from-red-500 to-rose-600',
    isCondition: true
  },
  { 
    type: 'condition-payment-success', 
    label: 'Payment Success', 
    icon: CheckCircle, 
    description: 'When payment processes',
    category: 'Conditions',
    gradient: 'from-green-400 to-emerald-600',
    isCondition: true
  },
  { 
    type: 'condition-subscription-cancelled', 
    label: 'Subscription Cancelled', 
    icon: UserX, 
    description: 'When customer cancels',
    category: 'Conditions',
    gradient: 'from-red-400 to-pink-500',
    isCondition: true
  },
  { 
    type: 'condition-trial-ending', 
    label: 'Trial Ending Soon', 
    icon: Clock, 
    description: 'When trial expires in X days',
    category: 'Conditions',
    gradient: 'from-amber-400 to-orange-500',
    isCondition: true
  },
  { 
    type: 'condition-high-usage', 
    label: 'High Usage Detected', 
    icon: TrendingUp, 
    description: 'When limits are approaching',
    category: 'Conditions',
    gradient: 'from-purple-400 to-violet-600',
    isCondition: true
  },
  { 
    type: 'condition-support-ticket', 
    label: 'Support Ticket Created', 
    icon: AlertCircle, 
    description: 'When customer needs help',
    category: 'Conditions',
    gradient: 'from-yellow-400 to-amber-500',
    isCondition: true
  },
  { 
    type: 'condition-new-signup', 
    label: 'New User Signup', 
    icon: UserPlus, 
    description: 'When someone joins',
    category: 'Conditions',
    gradient: 'from-cyan-400 to-blue-500',
    isCondition: true
  },
  { 
    type: 'condition-inactive-user', 
    label: 'User Inactive', 
    icon: Activity, 
    description: 'When user stops engaging',
    category: 'Conditions',
    gradient: 'from-slate-400 to-slate-600',
    isCondition: true
  },
  { 
    type: 'condition-order-placed', 
    label: 'Order Placed', 
    icon: Package, 
    description: 'When new order comes in',
    category: 'Conditions',
    gradient: 'from-indigo-400 to-purple-500',
    isCondition: true
  },
  { 
    type: 'condition-review-received', 
    label: 'Review Received', 
    icon: Star, 
    description: 'When customer leaves review',
    category: 'Conditions',
    gradient: 'from-yellow-300 to-yellow-500',
    isCondition: true
  },
  { 
    type: 'condition-meeting-scheduled', 
    label: 'Meeting Scheduled', 
    icon: Calendar, 
    description: 'When calendar event is booked',
    category: 'Conditions',
    gradient: 'from-teal-400 to-cyan-500',
    isCondition: true
  },
  { 
    type: 'condition-form-submitted', 
    label: 'Form Submitted', 
    icon: FileText, 
    description: 'When form is completed',
    category: 'Conditions',
    gradient: 'from-blue-400 to-indigo-500',
    isCondition: true
  },
  { 
    type: 'condition-if-then', 
    label: 'If/Then Logic', 
    icon: Split, 
    description: 'Custom condition branching',
    category: 'Conditions',
    gradient: 'from-purple-400 to-pink-500',
    isCondition: true
  },

  // ============================================
  // ACTION BLOCKS (Revenue-Driving Actions)
  // ============================================
  { 
    type: 'action-send-email', 
    label: 'Send Email', 
    icon: Send, 
    description: 'Send automated email',
    category: 'Actions',
    gradient: 'from-blue-400 to-blue-600'
  },
  { 
    type: 'action-reply-email', 
    label: 'Reply to Email', 
    icon: Reply, 
    description: 'Auto-reply to thread',
    category: 'Actions',
    gradient: 'from-cyan-400 to-teal-500'
  },
  { 
    type: 'action-send-invoice', 
    label: 'Send Invoice', 
    icon: ReceiptText, 
    description: 'Email invoice to customer',
    category: 'Actions',
    gradient: 'from-green-400 to-emerald-600'
  },
  { 
    type: 'action-resend-invoice', 
    label: 'Resend Invoice', 
    icon: RefreshCw, 
    description: 'Retry failed payment',
    category: 'Actions',
    gradient: 'from-orange-400 to-amber-600'
  },
  { 
    type: 'action-alert-team', 
    label: 'Alert Team', 
    icon: Bell, 
    description: 'Notify team members',
    category: 'Actions',
    gradient: 'from-red-400 to-rose-500'
  },
  { 
    type: 'action-schedule-followup', 
    label: 'Schedule Follow-up', 
    icon: Calendar, 
    description: 'Set reminder for later',
    category: 'Actions',
    gradient: 'from-purple-400 to-violet-500'
  },
  { 
    type: 'action-create-task', 
    label: 'Create Task', 
    icon: CheckCircle, 
    description: 'Add to task manager',
    category: 'Actions',
    gradient: 'from-indigo-400 to-blue-500'
  },
  { 
    type: 'action-update-crm', 
    label: 'Update CRM', 
    icon: Users, 
    description: 'Sync customer data',
    category: 'Actions',
    gradient: 'from-violet-400 to-purple-500'
  },
  { 
    type: 'action-apply-discount', 
    label: 'Apply Discount', 
    icon: DollarSign, 
    description: 'Send promotional offer',
    category: 'Actions',
    gradient: 'from-green-400 to-teal-500'
  },
  { 
    type: 'action-pause-subscription', 
    label: 'Pause Subscription', 
    icon: Timer, 
    description: 'Temporarily halt billing',
    category: 'Actions',
    gradient: 'from-amber-400 to-orange-500'
  },
  { 
    type: 'action-cancel-subscription', 
    label: 'Cancel Subscription', 
    icon: XCircle, 
    description: 'End customer subscription',
    category: 'Actions',
    gradient: 'from-red-500 to-red-700'
  },
  { 
    type: 'action-send-sms', 
    label: 'Send SMS', 
    icon: Phone, 
    description: 'Text message customer',
    category: 'Actions',
    gradient: 'from-cyan-400 to-blue-500'
  },
  { 
    type: 'action-log-activity', 
    label: 'Log Activity', 
    icon: Activity, 
    description: 'Record to database',
    category: 'Actions',
    gradient: 'from-slate-400 to-slate-600'
  },
  { 
    type: 'action-webhook', 
    label: 'Call Webhook', 
    icon: Webhook, 
    description: 'Trigger external API',
    category: 'Actions',
    gradient: 'from-indigo-500 to-purple-600'
  },
  { 
    type: 'action-wait', 
    label: 'Wait', 
    icon: Clock, 
    description: 'Delay next action',
    category: 'Actions',
    gradient: 'from-gray-400 to-gray-600'
  },

  // ============================================
  // INTEGRATION BLOCKS (Connect Services)
  // ============================================
  { 
    type: 'integration-stripe', 
    label: 'Stripe', 
    icon: CreditCard, 
    description: 'Payment processing',
    category: 'Integrations',
    gradient: 'from-indigo-500 to-purple-600'
  },
  { 
    type: 'integration-slack', 
    label: 'Slack', 
    icon: MessageSquare, 
    description: 'Team messaging',
    category: 'Integrations',
    gradient: 'from-purple-400 to-pink-500'
  },
  { 
    type: 'integration-gmail', 
    label: 'Gmail', 
    icon: Mail, 
    description: 'Email integration',
    category: 'Integrations',
    gradient: 'from-red-400 to-rose-500'
  },
  { 
    type: 'integration-calendar', 
    label: 'Calendar', 
    icon: Calendar, 
    description: 'Schedule & meetings',
    category: 'Integrations',
    gradient: 'from-blue-400 to-cyan-500'
  },
  { 
    type: 'integration-salesforce', 
    label: 'Salesforce', 
    icon: Users, 
    description: 'CRM integration',
    category: 'Integrations',
    gradient: 'from-cyan-500 to-blue-600'
  },
  { 
    type: 'integration-hubspot', 
    label: 'HubSpot', 
    icon: TrendingUp, 
    description: 'Marketing automation',
    category: 'Integrations',
    gradient: 'from-orange-400 to-red-500'
  },
  { 
    type: 'integration-shopify', 
    label: 'Shopify', 
    icon: ShoppingCart, 
    description: 'E-commerce platform',
    category: 'Integrations',
    gradient: 'from-green-400 to-emerald-600'
  },
  { 
    type: 'integration-twilio', 
    label: 'Twilio', 
    icon: Phone, 
    description: 'SMS & calling',
    category: 'Integrations',
    gradient: 'from-red-500 to-pink-500'
  },
  { 
    type: 'integration-github', 
    label: 'GitHub', 
    icon: Github, 
    description: 'Code repository',
    category: 'Integrations',
    gradient: 'from-gray-700 to-gray-900'
  },
  { 
    type: 'integration-notion', 
    label: 'Notion', 
    icon: BookOpen, 
    description: 'Documentation',
    category: 'Integrations',
    gradient: 'from-slate-800 to-black'
  },
  { 
    type: 'integration-database', 
    label: 'Database', 
    icon: Database, 
    description: 'SQL/NoSQL queries',
    category: 'Integrations',
    gradient: 'from-emerald-500 to-teal-600'
  },
  { 
    type: 'integration-analytics', 
    label: 'Analytics', 
    icon: Activity, 
    description: 'Track metrics',
    category: 'Integrations',
    gradient: 'from-violet-400 to-purple-600'
  },

  // ============================================
  // REFERENCE BLOCKS (Visual Documentation)
  // ============================================
  { 
    type: 'reference-note', 
    label: 'Note', 
    icon: Pencil, 
    description: 'Add documentation',
    category: 'Reference',
    gradient: 'from-yellow-300 to-amber-400'
  },
  { 
    type: 'reference-checkpoint', 
    label: 'Checkpoint', 
    icon: Eye, 
    description: 'Mark important step',
    category: 'Reference',
    gradient: 'from-blue-400 to-indigo-500'
  },
  { 
    type: 'reference-custom', 
    label: 'Custom Step', 
    icon: Code2, 
    description: 'Placeholder for logic',
    category: 'Reference',
    gradient: 'from-gray-500 to-gray-700'
  },
]

export const BLOCK_CATEGORIES = ['Conditions', 'Actions', 'Integrations', 'Reference'] as const