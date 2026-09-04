import { ReceiptCustomizationSettings, KotCustomizationSettings } from '@/types';
import { db } from './storage/db';
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  private supabaseChannel: RealtimeChannel | null = null;
  private listeners: Set<(msg: SocketMessage) => void> = new Set();
  private statusListeners: Set<(status: SocketStatus) => void> = new Set();
  private status: SocketStatus = 'CONNECTED';
  private latencyMs: number = 14;
  private connectedTerminals: string[] = ['POS-Register-01', 'Kitchen-KOT-01', 'Takeaway-Counter-02'];
  private pingInterval: any = null;

  constructor() {
    // 1. Local Cross-Tab BroadcastChannel (Instant on same machine/browser)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('chill_and_choc_receipt_ws_sync');
        this.channel.onmessage = (event) => {
          const msg = event.data as SocketMessage;
          this.notifyListeners(msg);
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization fallback in receipt socket:', err);
      }
    }

    // 2. Supabase Realtime WebSocket Channel (Cross-device, multi-terminal cloud sync)
    if (typeof window !== 'undefined') {
      try {
        this.supabaseChannel = supabase
          .channel('receipt_and_kot_realtime_channel')
          .on('broadcast', { event: 'RECEIPT_TEMPLATE_UPDATED' }, (payload) => {
            if (payload && payload.payload) {
              const msg: SocketMessage = {
                id: `sb_ws_${Date.now()}`,
                type: 'RECEIPT_TEMPLATE_UPDATED',
                source: 'Supabase Realtime WebSocket',
                timestamp: new Date().toISOString(),
                payload: payload.payload,
              };
              this.notifyListeners(msg);
            }
          })
          .on('broadcast', { event: 'KOT_TEMPLATE_UPDATED' }, (payload) => {
            if (payload && payload.payload) {
              const msg: SocketMessage = {
                id: `sb_ws_${Date.now()}`,
                type: 'KOT_TEMPLATE_UPDATED',
                source: 'Supabase Realtime WebSocket',
                timestamp: new Date().toISOString(),
                payload: payload.payload,
              };
              this.notifyListeners(msg);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              this.status = 'CONNECTED';
              this.notifyStatusListeners('CONNECTED');
            } else if (status === 'CHANNEL_ERROR') {
              this.status = 'DISCONNECTED';
              this.notifyStatusListeners('DISCONNECTED');
            }
          });
      } catch (err) {
        console.warn('Could not initialize Supabase Realtime receipt channel:', err);
      }

      // Latency simulation
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

  /**
   * Helper to subscribe specifically to receipt customization changes
   */
  public subscribeReceiptUpdates(callback: (settings: ReceiptCustomizationSettings) => void): () => void {
    return this.subscribe((msg) => {
      if (msg.type === 'RECEIPT_TEMPLATE_UPDATED' && msg.payload) {
        callback(msg.payload);
      }
    });
  }

  /**
   * Helper to subscribe specifically to KOT customization changes
   */
  public subscribeKotUpdates(callback: (settings: KotCustomizationSettings) => void): () => void {
    return this.subscribe((msg) => {
      if (msg.type === 'KOT_TEMPLATE_UPDATED' && msg.payload) {
        callback(msg.payload);
      }
    });
  }

  public subscribeStatus(callback: (status: SocketStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatusListeners(status: SocketStatus) {
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('Error in receipt socket status listener:', err);
      }
    });
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
  public async broadcastReceiptUpdate(settings: ReceiptCustomizationSettings, source: string = 'Admin Studio') {
    // 1. Update Database in memory and localStorage
    db.update('settings', (prev) => ({
      ...prev,
      businessName: settings.businessName !== undefined ? settings.businessName : prev.businessName,
      tagline: settings.tagline !== undefined ? settings.tagline : prev.tagline,
      address: settings.address !== undefined ? settings.address : prev.address,
      phone: settings.phone !== undefined ? settings.phone : prev.phone,
      receiptFooter: settings.receiptFooter !== undefined ? settings.receiptFooter : prev.receiptFooter,
      receiptCustomization: settings,
    }));

    // 2. Broadcast over local BroadcastChannel
    const message: SocketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: 'RECEIPT_TEMPLATE_UPDATED',
      source,
      timestamp: new Date().toISOString(),
      payload: settings,
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('Failed to postMessage on BroadcastChannel:', err);
      }
    }
    this.notifyListeners(message);

    // 3. Broadcast over Supabase Realtime WebSocket (Cloud Sync across all devices)
    if (this.supabaseChannel) {
      try {
        await this.supabaseChannel.send({
          type: 'broadcast',
          event: 'RECEIPT_TEMPLATE_UPDATED',
          payload: settings,
        });
      } catch (err) {
        console.warn('Failed to broadcast via Supabase Realtime channel:', err);
      }
    }
  }

  /**
   * Broadcast real-time KOT ticket customization update to POS registers & Kitchen terminals
   */
  public async broadcastKotUpdate(settings: KotCustomizationSettings, source: string = 'Admin Studio') {
    // 1. Update Database
    db.update('settings', (prev) => ({
      ...prev,
      kotCustomization: settings,
    }));

    // 2. Broadcast over local BroadcastChannel
    const message: SocketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: 'KOT_TEMPLATE_UPDATED',
      source,
      timestamp: new Date().toISOString(),
      payload: settings,
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('Failed to postMessage on BroadcastChannel:', err);
      }
    }
    this.notifyListeners(message);

    // 3. Broadcast over Supabase Realtime WebSocket
    if (this.supabaseChannel) {
      try {
        await this.supabaseChannel.send({
          type: 'broadcast',
          event: 'KOT_TEMPLATE_UPDATED',
          payload: settings,
        });
      } catch (err) {
        console.warn('Failed to broadcast KOT via Supabase Realtime channel:', err);
      }
    }
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
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('Failed to postMessage on BroadcastChannel:', err);
      }
    }
    this.notifyListeners(message);
  }
}

export const receiptSocketService = new ReceiptSocketService();
