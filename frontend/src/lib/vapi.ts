import Vapi from '@vapi-ai/web';

// Replace with your Vapi Assistant ID after creating it in dashboard
const VAPI_ASSISTANT_ID = 'a6167bcf-4edf-466d-9c0f-685dc70d23e0';

export class VapiService {
  private vapi: Vapi;
  private isConnected: boolean = false;

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
      // Start call with assistant
      await this.vapi.start(VAPI_ASSISTANT_ID);
      this.isConnected = true;
      onStatusChange('listening');

      // Listen for speech updates
      this.vapi.on('speech-start', () => {
        console.log('🎤 User started speaking');
        onStatusChange('listening');
      });

      this.vapi.on('speech-end', () => {
        console.log('🤫 User stopped speaking');
        onStatusChange('thinking');
      });

      // Listen for transcripts (when user finishes speaking)
      this.vapi.on('message', (message: any) => {
        console.log('📝 Vapi message:', message);
        
        // Check if this is a transcript message
        if (message.type === 'transcript' && message.role === 'user') {
          const transcript = message.transcript || message.transcriptType;
          if (transcript) {
            console.log('✅ User transcript:', transcript);
            onTranscript(transcript);
          }
        }
      });

      // Listen for assistant speaking
      this.vapi.on('call-start', () => {
        console.log('📞 Call started');
      });

      this.vapi.on('call-end', () => {
        console.log('📞 Call ended');
        this.isConnected = false;
        onStatusChange('idle');
      });

      // Error handling
      this.vapi.on('error', (error: any) => {
        console.error('❌ Vapi error:', error);
        onError(new Error(error.message || 'Vapi error occurred'));
        this.isConnected = false;
        onStatusChange('idle');
      });

    } catch (error) {
      console.error('❌ Failed to start Vapi:', error);
      this.isConnected = false;
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