import Vapi from '@vapi-ai/web';

const VAPI_ASSISTANT_ID = 'a6167bcf-4edf-466d-9c0f-685dc70d23e0';

export class VapiService {
  private vapi: Vapi;
  private isConnected: boolean = false;
  private hasProcessedMessage: boolean = false;

  constructor() {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('NEXT_PUBLIC_VAPI_PUBLIC_KEY not found');
    }
    this.vapi = new Vapi(publicKey);
  }

  /**
   * Start voice conversation
   * Returns transcript when user finishes speaking
   */
  async startConversation(
    onTranscript: (transcript: string) => void,
    onError: (error: Error) => void,
    onStatusChange: (status: 'listening' | 'thinking' | 'speaking' | 'idle') => void
  ): Promise<void> {
    try {
      this.hasProcessedMessage = false;
      
      await this.vapi.start(VAPI_ASSISTANT_ID);
      
      this.isConnected = true;
      onStatusChange('listening');

      // Listen for all messages
      this.vapi.on('message', (message: any) => {
        // Handle conversation-update messages
        if (message.type === 'conversation-update' && !this.hasProcessedMessage) {
          console.log('💬 CONVERSATION UPDATE received');
          
          if (!message.conversation) {
            return;
          }
          
          // Get the last user message from the conversation
          const messages = message.conversation;
          const lastMessage = messages[messages.length - 1];
          
          console.log('Last message:', lastMessage);
          
          // Check if it's a user message (not system or assistant)
          if (lastMessage && lastMessage.role === 'user' && lastMessage.content) {
            const userTranscript = lastMessage.content;
            
            console.log('✅ USER TRANSCRIPT FROM CONVERSATION:', userTranscript);
            
            // Prevent duplicate processing
            this.hasProcessedMessage = true;
            
            // Send the transcript to the handler
            onStatusChange('thinking');
            onTranscript(userTranscript);
          }
        }
        
        // Handle speech-update messages for UI status
        if (message.type === 'speech-update') {
          console.log('📢 Speech update:', message.role, message.status);
          
          if (message.role === 'user') {
            if (message.status === 'started') {
              console.log('🎤 User started speaking');
              this.hasProcessedMessage = false; // Reset for next message
              onStatusChange('listening');
            }
          } else if (message.role === 'assistant') {
            if (message.status === 'started') {
              console.log('🔊 Assistant started speaking');
              onStatusChange('speaking');
            } else if (message.status === 'stopped') {
              console.log('✅ Assistant finished speaking - resetting to idle');
              // Assistant finished speaking, go back to idle/ready state
              onStatusChange('idle');
            }
          }
        }
      });

      this.vapi.on('call-start', () => {
        console.log('📞 Call started');
      });

      this.vapi.on('call-end', () => {
        console.log('📞 Call ended');
        this.isConnected = false;
        this.hasProcessedMessage = false;
        onStatusChange('idle');
      });

      this.vapi.on('error', (error: any) => {
        console.error('❌ Vapi error:', error);
        onError(new Error(error.message || 'Vapi error occurred'));
        this.isConnected = false;
        this.hasProcessedMessage = false;
        onStatusChange('idle');
      });

    } catch (error) {
      console.error('❌ Failed to start Vapi:', error);
      this.isConnected = false;
      this.hasProcessedMessage = false;
      onError(error as Error);
      onStatusChange('idle');
    }
  }

  /**
   * Stop the conversation
   */
  async stopConversation(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.vapi.stop();
        this.isConnected = false;
        this.hasProcessedMessage = false;
        console.log('⏹️ Conversation stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping Vapi:', error);
    }
  }

  /**
   * Send a message to the assistant (optional - for text input)
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Vapi');
    }
    this.vapi.send({
      type: 'add-message',
      message: {
        role: 'user',
        content: message,
      },
    });
  }

  /**
   * Check if currently connected
   */
  isActive(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const vapiService = new VapiService();