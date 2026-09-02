import { ReceiptCustomizationSettings, KotCustomizationSettings } from '@/types';
import { db } from './storage/db';

export type SocketStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

export interface SocketMessage {
  id: string;
  type:
    | 'RECEIPT_TEMPLATE_UPDATED'
    | 'KOT_TEMPLATE_UPDATED'
    | 'POS_HEARTBEAT'
    | 'TERMINAL_CONNECTED'
    | 'TEST_PRINT_REQUEST';
  source: string;
  timestamp: string;
  payload?: any;
}

class ReceiptSocketService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: SocketMessage) => void> = new Set();
  private statusListeners: Set<(status: SocketStatus) => void> = new Set();
  private status: SocketStatus = 'CONNECTED';
  private latencyMs: number = 14;
  private connectedTerminals: string[] = ['POS-Register-01', 'Kitchen-KOT-01', 'Takeaway-Counter-02'];
  private pingInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('chill_and_choc_receipt_ws_sync');
      this.channel.onmessage = (event) => {
        const msg = event.data as SocketMessage;
        this.notifyListeners(msg);
      };
    }

    // Simulate realistic network latency fluctuation
    if (typeof window !== 'undefined') {
      this.pingInterval = setInterval(() => {
        this.latencyMs = Math.floor(10 + Math.random() * 12);
      }, 5000);
    }
  }

  public getStatus(): SocketStatus {
    return this.status;
  }

  public getLatency(): number {
    return this.latencyMs;
  }

  public getConnectedTerminals(): string[] {
    return this.connectedTerminals;
  }

  public subscribe(callback: (msg: SocketMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public subscribeStatus(callback: (status: SocketStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  private notifyListeners(msg: SocketMessage) {
    this.listeners.forEach((cb) => {
      try {
        cb(msg);
      } catch (err) {
        console.error('Error in receipt socket listener:', err);
      }
    });
  }

  /**
   * Broadcast real-time receipt template update to all listening POS registers
   */
  public broadcastReceiptUpdate(settings: ReceiptCustomizationSettings, source: string = 'Admin Studio') {
    // 1. Update Database
    db.update('settings', (prev) => ({
      ...prev,
      businessName: settings.businessName || prev.businessName,
      tagline: settings.tagline || prev.tagline,
      address: settings.address || prev.address,
      phone: settings.phone || prev.phone,
      receiptFooter: settings.receiptFooter || prev.receiptFooter,
      receiptCustomization: settings,
    }));

    // 2. Broadcast over WebSocket channel
    const message: SocketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: 'RECEIPT_TEMPLATE_UPDATED',
      source,
      timestamp: new Date().toISOString(),
      payload: settings,
    };

    if (this.channel) {
      this.channel.postMessage(message);
    }
    this.notifyListeners(message);
  }

  /**
   * Broadcast real-time KOT ticket customization update to POS registers & Kitchen terminals
   */
  public broadcastKotUpdate(settings: KotCustomizationSettings, source: string = 'Admin Studio') {
    // 1. Update Database
    db.update('settings', (prev) => ({
      ...prev,
      kotCustomization: settings,
    }));

    // 2. Broadcast over WebSocket channel
    const message: SocketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: 'KOT_TEMPLATE_UPDATED',
      source,
      timestamp: new Date().toISOString(),
      payload: settings,
    };

    if (this.channel) {
      this.channel.postMessage(message);
    }
    this.notifyListeners(message);
  }

  /**
   * Send test print signal over WebSocket
   */
  public broadcastTestPrint(terminalId?: string) {
    const message: SocketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: 'TEST_PRINT_REQUEST',
      source: 'Admin Studio',
      timestamp: new Date().toISOString(),
      payload: { terminalId: terminalId || 'ALL_TERMINALS' },
    };

    if (this.channel) {
      this.channel.postMessage(message);
    }
    this.notifyListeners(message);
  }
}

export const receiptSocketService = new ReceiptSocketService();
