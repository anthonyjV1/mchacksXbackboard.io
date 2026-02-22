// frontend/lib/workflow-templates.ts

export interface WorkflowTemplate {
  id: string;
  name: string;
  keywords: string[];
  blocks: Array<{
    type: string;
    title: string;
    description: string;
  }>;
  message: string;
  description?: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "email-reply-automation",
    name: "Email Reply Automation",
    keywords: ["reply", "respond", "answer", "reply to email", "auto reply", "respond to email", "replies", "automatically replies"],
    blocks: [
      {
        type: "integration-gmail",
        title: "Gmail Integration",
        description: "Connect your Gmail account"
      },
      {
        type: "condition-email-received",
        title: "Email Received",
        description: "Triggers when new email arrives"
      },
      {
        type: "action-reply-email",
        title: "Reply to Email",
        description: "Send automated reply"
      }
    ],
    message: "Perfect! I've created an email reply automation for you. Just connect your Gmail and set up your reply message, and you're ready to go!",
    description: "Automatically reply to incoming emails"
  },
  {
    id: "email-sender",
    name: "Email Sender",
    keywords: ["send email", "send message", "email someone"],
    blocks: [
      {
        type: "integration-gmail",
        title: "Gmail Integration",
        description: "Connect your Gmail account"
      },
      {
        type: "condition-email-received",
        title: "Email Received",
        description: "Triggers when new email arrives"
      },
      {
        type: "action-send-email",
        title: "Send Email",
        description: "Send automated email"
      }
    ],
    message: "Awesome! I've set up an email sender workflow for you. Connect Gmail and configure who you want to send emails to.",
    description: "Send automated emails based on triggers"
  },
  {
    id: "outlook-reply-automation",
    name: "Outlook Reply Automation",
    keywords: ["outlook", "reply", "respond", "answer", "reply to email", "auto reply", "respond to email", "replies", "automatically replies"],
    blocks: [
      {
        type: "integration-outlook",
        title: "Outlook Integration",
        description: "Connect your Outlook account"
      },
      {
        type: "condition-email-received",
        title: "Email Received",
        description: "Triggers when new email arrives"
      },
      {
        type: "action-reply-email",
        title: "Reply to Email",
        description: "Send automated reply"
      }
    ],
    message: "Perfect! I've created an email reply automation for you. Just connect your Gmail and set up your reply message, and you're ready to go!",
    description: "Automatically reply to incoming emails"
  },
];

export function findMatchingTemplate(transcript: string): WorkflowTemplate | null {
  const lowerTranscript = transcript.toLowerCase();
  
  // Find the best matching template based on keywords
  for (const template of WORKFLOW_TEMPLATES) {
    for (const keyword of template.keywords) {
      if (lowerTranscript.includes(keyword.toLowerCase())) {
        return template;
      }
    }
  }
  
  return null;
}

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === id);
}

export function getAllTemplateNames(): string[] {
  return WORKFLOW_TEMPLATES.map(t => t.name);
}