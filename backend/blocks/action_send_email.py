"""
Action block: Send email with optional AI personalization
FEATURES:
- Send to single or multiple recipients
- Custom subject and body
- Works with Gmail and Outlook
- AI personalization (scaffold for future web scraping)
"""
import os
from supabase import create_client
from dotenv import load_dotenv
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import base64
from email.mime.text import MIMEText

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def get_user_gmail_service(user_id: str):
    """Get Gmail service for user"""
    result = supabase.table("user_oauth_credentials")\
        .select("*")\
        .eq("user_id", user_id)\
        .eq("provider", "gmail")\
        .single()\
        .execute()
    
    if not result.data:
        raise Exception(f"No Gmail credentials found for user {user_id}")
    
    creds_data = result.data
    
    creds = Credentials(
        token=creds_data['access_token'],
        refresh_token=creds_data['refresh_token'],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=['https://www.googleapis.com/auth/gmail.readonly', 
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.modify']
    )
    
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        
        supabase.table("user_oauth_credentials").update({
            "access_token": creds.token,
            "token_expiry": creds.expiry.isoformat() if creds.expiry else None
        }).eq("user_id", user_id).eq("provider", "gmail").execute()
    
    return build('gmail', 'v1', credentials=creds)


def get_user_outlook_service(user_id: str):
    """Get Outlook service for user"""
    from services.outlook_service import get_outlook_service
    return get_outlook_service(user_id)


def personalize_email(email_body: str, recipient_email: str, personalization_data: dict = None):
    """
    Personalize email content with recipient-specific data
    
    FUTURE: This will use web scraping + AI to find:
    - Recipient's name
    - Company info
    - Recent news/achievements
    - Role/title
    
    For now: Basic template replacement
    """
    
    if not personalization_data:
        # TODO: In the future, scrape web for data
        # For now, just return the email as-is
        return email_body
    
    # Replace template variables
    personalized = email_body
    for key, value in personalization_data.items():
        personalized = personalized.replace(f"{{{{{key}}}}}", str(value))
    
    return personalized


def send_gmail(user_id: str, to_email: str, subject: str, body: str):
    """Send email via Gmail"""
    service = get_user_gmail_service(user_id)
    
    message = MIMEText(body)
    message['to'] = to_email
    message['subject'] = subject
    
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    result = service.users().messages().send(
        userId='me',
        body={'raw': raw_message}
    ).execute()
    
    print(f"Gmail sent to {to_email}: {result['id']}")
    return result


def send_outlook(user_id: str, to_email: str, subject: str, body: str):
    """Send email via Outlook"""
    service = get_user_outlook_service(user_id)
    
    message = {
        'message': {
            'subject': subject,
            'body': {
                'contentType': 'Text',
                'content': body
            },
            'toRecipients': [
                {'emailAddress': {'address': to_email}}
            ]
        }
    }
    
    service._make_request('POST', '/me/sendMail', json=message)
    
    print(f"Outlook sent to {to_email}")
    return {'sent': True}


async def execute_send_email(
    workspace_id: str,
    user_id: str,
    trigger_data: dict,
    config: dict
) -> dict:
    """
    Main execution function for send-email action
    
    Config structure:
    {
        "recipients": ["email1@example.com", "email2@example.com"],
        "subject": "Email subject",
        "emailBody": "Email content with optional {{variables}}",
        "usePersonalization": false
    }
    """
    try:
        # Get configuration
        recipients = config.get("recipients", [])
        subject = config.get("subject", "")
        email_body = config.get("emailBody", "")
        use_personalization = config.get("usePersonalization", False)
        
        # Detect provider from trigger (if triggered by email) or check user's integrations
        provider = trigger_data.get("provider", "gmail")  # Default to Gmail
        
        print(f"\n{'='*60}")
        print(f"   Sending email(s)")
        print(f"   Provider: {provider.upper()}")
        print(f"   Recipients: {len(recipients)}")
        print(f"   Subject: {subject}")
        print(f"{'='*60}\n")
        
        if not recipients:
            raise Exception("No recipients specified")
        
        if not subject or not email_body:
            raise Exception("Subject and email body are required")
        
        # Send to each recipient
        results = []
        for recipient in recipients:
            print(f"Sending to: {recipient}")
            
            # Personalize email if enabled
            if use_personalization:
                print(f"✨ Personalizing email for {recipient}")
                # TODO: In the future, scrape web for recipient data
                # For now, just use the email as-is
                personalized_body = personalize_email(email_body, recipient)
            else:
                personalized_body = email_body
            
            # Send via appropriate provider
            if provider == "outlook":
                result = send_outlook(user_id, recipient, subject, personalized_body)
            else:
                result = send_gmail(user_id, recipient, subject, personalized_body)
            
            results.append({
                "recipient": recipient,
                "status": "sent",
                "result": result
            })
        
        print(f"\nSuccessfully sent {len(results)} email(s)\n")
        
        return {
            "status": "success",
            "emails_sent": len(results),
            "recipients": recipients,
            "results": results
        }
    
    except Exception as e:
        print(f"Error in send_email action: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }