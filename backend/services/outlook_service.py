#services/outlook_service.py
import os
import requests
from datetime import datetime, timedelta, timezone
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

class OutlookService:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.access_token = None
        self._refresh_token_if_needed()
    
    def _refresh_token_if_needed(self):
        """Get access token and refresh if expired"""
        result = supabase.table("user_oauth_credentials")\
            .select("*")\
            .eq("user_id", self.user_id)\
            .eq("provider", "outlook")\
            .single()\
            .execute()
        
        if not result.data:
            raise Exception(f"No Outlook credentials found for user {self.user_id}")
        
        creds = result.data
        expiry = datetime.fromisoformat(creds['token_expiry'])
        
        # Make expiry timezone-aware if it isn't already
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        
        # Refresh if expired or expiring soon (within 5 mins)
        now_utc = datetime.now(timezone.utc)
        if expiry < now_utc + timedelta(minutes=5):
            print(f"Refreshing Outlook token for user {self.user_id}...")
            
            token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            token_data = {
                'client_id': os.getenv("MICROSOFT_CLIENT_ID"),
                'client_secret': os.getenv("MICROSOFT_CLIENT_SECRET"),
                'refresh_token': creds['refresh_token'],
                'grant_type': 'refresh_token',
                'scope': creds['scope']
            }
            
            response = requests.post(token_url, data=token_data)
            response.raise_for_status()
            tokens = response.json()
            
            # Update database with timezone-aware datetime
            new_expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens['expires_in'])
            supabase.table("user_oauth_credentials").update({
                "access_token": tokens['access_token'],
                "token_expiry": new_expiry.isoformat(),
                "refresh_token": tokens.get('refresh_token', creds['refresh_token'])
            }).eq("user_id", self.user_id).eq("provider", "outlook").execute()
            
            self.access_token = tokens['access_token']
            print(f"Outlook token refreshed")
        else:
            self.access_token = creds['access_token']
    
    def _make_request(self, method: str, endpoint: str, **kwargs):
        """Make authenticated request to Microsoft Graph API"""
        url = f"https://graph.microsoft.com/v1.0{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
        
        if 'headers' in kwargs:
            headers.update(kwargs.pop('headers'))
        
        response = requests.request(method, url, headers=headers, **kwargs)
        
        if response.status_code == 401:
            print(f"Got 401, forcing token refresh...")
            token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            
            creds_result = supabase.table("user_oauth_credentials")\
                .select("*").eq("user_id", self.user_id).eq("provider", "outlook").single().execute()
            creds = creds_result.data
            
            token_response = requests.post(token_url, data={
                'client_id': os.getenv("MICROSOFT_CLIENT_ID"),
                'client_secret': os.getenv("MICROSOFT_CLIENT_SECRET"),
                'refresh_token': creds['refresh_token'],
                'grant_type': 'refresh_token',
                'scope': creds['scope']
            })
            
            if token_response.ok:
                tokens = token_response.json()
                new_expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens['expires_in'])
                supabase.table("user_oauth_credentials").update({
                    "access_token": tokens['access_token'],
                    "refresh_token": tokens.get('refresh_token', creds['refresh_token']),
                    "token_expiry": new_expiry.isoformat()
                }).eq("user_id", self.user_id).eq("provider", "outlook").execute()
                self.access_token = tokens['access_token']
                print(f"Token force-refreshed")
                headers['Authorization'] = f'Bearer {self.access_token}'
                response = requests.request(method, url, headers=headers, **kwargs)
            else:
                print(f"Token refresh failed: {token_response.text}")
                response.raise_for_status()  # raise the original 401 explicitly

        # THEN after the if block, do the error checking:
        if not response.ok:
            print(f"   Microsoft Graph API Error:")
            print(f"   Status: {response.status_code}")
            print(f"   URL: {url}")
            print(f"   Request Body: {kwargs.get('json', 'N/A')}")
            print(f"   Response: {response.text}")
            try:
                error_json = response.json()
                print(f"   Error Details: {error_json}")
            except:
                pass

        response.raise_for_status()
        return response.json() if response.text else {}
    
    def get_user_email(self):
        """Get user's email address"""
        result = self._make_request('GET', '/me')
        return result.get('mail') or result.get('userPrincipalName')
    
    def get_message(self, message_id: str):
        """Get a specific message"""
        return self._make_request('GET', f'/me/messages/{message_id}')
    
    def create_draft_reply(self, message_id: str, body: str):
        """Create a draft reply to a message"""
        
        # First, create the reply
        reply_draft = self._make_request('POST', f'/me/messages/{message_id}/createReply')
        
        draft_id = reply_draft['id']
        
        # Update the draft with our content
        update_data = {
            'body': {
                'contentType': 'Text',
                'content': body
            }
        }
        
        self._make_request('PATCH', f'/me/messages/{draft_id}', json=update_data)
        
        print(f"Draft reply created: {draft_id}")
        return {'id': draft_id}
    
    def send_reply(self, message_id: str, body: str):
        """Send a reply to a message immediately"""
        
        reply_data = {
            'comment': body  # Microsoft Graph uses 'comment' for reply body
        }
        
        self._make_request('POST', f'/me/messages/{message_id}/reply', json=reply_data)
        
        print(f"Reply sent to message {message_id}")
        return {'sent': True}
    
    def delete_drafts_in_conversation(self, conversation_id: str):
        """
        Delete all draft replies in a conversation
        This prevents multiple drafts from piling up
        """
        try:
            # Get all messages in conversation
            params = {
                '$filter': f"conversationId eq '{conversation_id}' and isDraft eq true",
                '$select': 'id,isDraft'
            }
            
            result = self._make_request('GET', '/me/messages', params=params)
            
            drafts = result.get('value', [])
            
            if drafts:
                print(f"🗑️  Found {len(drafts)} draft(s) in conversation {conversation_id}")
                
                for draft in drafts:
                    try:
                        self._make_request('DELETE', f'/me/messages/{draft["id"]}')
                        print(f"Deleted draft {draft['id']}")
                    except Exception as e:
                        print(f"Could not delete draft: {e}")
            else:
                print(f"No existing drafts in conversation")
        
        except Exception as e:
            print(f"Error checking for drafts: {e}")

# Helper function to get service
def get_outlook_service(user_id: str) -> OutlookService:
    return OutlookService(user_id)