import { Order, HeldOrder, CashierShift, CashDrawerTransaction, SystemSettings, ReceiptCustomizationSettings, User } from '@/types';

export type RealtimeSocketStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

export type RealtimeEventType =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_REFUND_REQUESTED'
  | 'ORDER_REFUNDED'
  | 'ORDER_REFUND_REJECTED'
  | 'ORDER_HELD'
  | 'ORDER_RESUMED'
  | 'CATALOG_CHANGED'
  | 'STOCK_CHANGED'
  | 'SHIFT_CHANGED'
  | 'DRAWER_TRANSACTION'
  | 'DRAWER_REQUEST_PENDING'
  | 'DRAWER_REQUEST_APPROVED'
  | 'DRAWER_REQUEST_REJECTED'
  | 'STOCK_REQUEST_PENDING'
  | 'STOCK_REQUEST_APPROVED'
  | 'STOCK_REQUEST_REJECTED'
  | 'SETTINGS_CHANGED'
  | 'RECEIPT_TEMPLATE_CHANGED'
  | 'STAFF_CHANGED'
  | 'ATTENDANCE_CHANGED'
  | 'KOT_DISPATCHED'
  | 'DATABASE_SYNC'
  | 'HEARTBEAT_PING'
  | 'HEARTBEAT_PONG';

export interface RealtimeMessage<T = any> {
  id: string;
  type: RealtimeEventType;
  source: 'BACKOFFICE' | 'POS-TERMINAL' | 'KITCHEN-STATION' | string;
  timestamp: string;
  payload: T;
}

class RealtimeSocketService {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<RealtimeEventType | '*', Set<(msg: RealtimeMessage) => void>> = new Map();
  private statusListeners: Set<(status: RealtimeSocketStatus) => void> = new Set();
  private status: RealtimeSocketStatus = 'CONNECTED';
  private latencyMs: number = 8;
  private connectedNodes: string[] = ['BACKOFFICE-ADMIN', 'POS-REGISTER-01', 'KITCHEN-KOT-01'];
  private heartbeatTimer: any = null;
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('chill_and_choc_realtime_cluster_mesh');
        this.channel.onmessage = (event) => {
          const msg = event.data as RealtimeMessage;
          this.handleIncomingMessage(msg);
        };
      } catch (e) {
        console.warn('BroadcastChannel initialization fallback', e);
      }

      // Listen to window-level custom events for same-window / sub-component broadcasts
      window.addEventListener('chill_choc_internal_ws_dispatch', ((e: CustomEvent) => {
        if (e.detail) {
          this.handleIncomingMessage(e.detail);
        }
      }) as EventListener);

      // Start periodic node heartbeat & latency simulation
      this.heartbeatTimer = setInterval(() => {
        this.latencyMs = Math.floor(6 + Math.random() * 8); // 6ms - 14ms ultra low latency
        this.broadcast('HEARTBEAT_PING', {
          nodeId: typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') ? 'BACKOFFICE' : 'POS-TERMINAL',
          timestamp: new Date().toISOString(),
        }, false);
      }, 10000);
    }
  }

  public getStatus(): RealtimeSocketStatus {
    return this.status;
  }

  public getLatency(): number {
    return this.latencyMs;
  }

  public getConnectedNodes(): string[] {
    return this.connectedNodes;
  }

  /**
   * Broadcast an event to all open tabs, windows, and connected instances.
   */
  public broadcast<T = any>(
    type: RealtimeEventType,
    payload: T,
    propagateLocally: boolean = true
  ): void {
    const msg: RealtimeMessage<T> = {
      id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      source:
        typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
          ? 'BACKOFFICE'
          : 'POS-TERMINAL',
      timestamp: new Date().toISOString(),
      payload,
    };

    // 1. Send via BroadcastChannel to other tabs / windows
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('Failed to postMessage over BroadcastChannel', err);
      }
    }

    // 2. Dispatch locally if requested
    if (propagateLocally) {
      if (msg.id) {
        this.processedMessageIds.add(msg.id);
        if (this.processedMessageIds.size > 300) {
          const first = this.processedMessageIds.values().next().value;
          if (first) this.processedMessageIds.delete(first);
        }
      }
      this.notifySubscribers(msg);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('chill_choc_internal_ws_dispatch', { detail: msg })
        );
      }
    }
  }

  /**
   * Subscribe to specific or all realtime WebSocket events.
   */
  public on(
    eventType: RealtimeEventType | '*',
    callback: (msg: RealtimeMessage) => void
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Subscribe to connection status changes.
   */
  public onStatusChange(callback: (status: RealtimeSocketStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Notify subscribers of incoming messages.
   */
  private handleIncomingMessage(msg: RealtimeMessage): void {
    if (!msg || !msg.id) return;
    if (this.processedMessageIds.has(msg.id)) return;
    this.processedMessageIds.add(msg.id);
    if (this.processedMessageIds.size > 300) {
      const first = this.processedMessageIds.values().next().value;
      if (first) this.processedMessageIds.delete(first);
    }
    this.notifySubscribers(msg);
  }

  private notifySubscribers(msg: RealtimeMessage): void {
    // Specific event listeners
    const specific = this.listeners.get(msg.type);
    if (specific) {
      specific.forEach((cb) => {
        try {
          cb(msg);
        } catch (e) {
          console.error(`Error in realtime socket listener for ${msg.type}:`, e);
        }
      });
    }

    // Wildcard listeners
    const wildcard = this.listeners.get('*');
    if (wildcard) {
      wildcard.forEach((cb) => {
        try {
          cb(msg);
        } catch (e) {
          console.error('Error in realtime socket wildcard listener:', e);
        }
      });
    }
  }

  // --- CONVENIENCE EMITTERS ---

  public emitOrderCreated(order: Order): void {
    this.broadcast('ORDER_CREATED', { order });
  }

  public emitOrderUpdated(order: Order): void {
    this.broadcast('ORDER_UPDATED', { order });
  }

  public emitOrderRefundRequested(order: Order): void {
    this.broadcast('ORDER_REFUND_REQUESTED', { order });
  }

  public emitOrderRefunded(order: Order): void {
    this.broadcast('ORDER_REFUNDED', { order });
  }

  public emitOrderRefundRejected(order: Order): void {
    this.broadcast('ORDER_REFUND_REJECTED', { order });
  }

  public emitOrderHeld(heldOrder: HeldOrder): void {
    this.broadcast('ORDER_HELD', { heldOrder });
  }

  public emitCatalogChanged(action: 'CREATE' | 'UPDATE' | 'DELETE', entity: 'product' | 'category', item: any): void {
    this.broadcast('CATALOG_CHANGED', { action, entity, item });
  }

  public emitStockChanged(ingredientId?: string, movement?: any): void {
    this.broadcast('STOCK_CHANGED', { ingredientId, movement });
  }

  public emitShiftChanged(shift: CashierShift): void {
    this.broadcast('SHIFT_CHANGED', { shift });
  }

  public emitDrawerTransaction(transaction: CashDrawerTransaction): void {
    this.broadcast('DRAWER_TRANSACTION', { transaction });
  }

  public emitDrawerRequestPending(transaction: CashDrawerTransaction): void {
    this.broadcast('DRAWER_REQUEST_PENDING', { transaction });
    this.broadcast('DRAWER_TRANSACTION', { transaction });
  }

  public emitDrawerRequestApproved(transaction: CashDrawerTransaction): void {
    this.broadcast('DRAWER_REQUEST_APPROVED', { transaction });
    this.broadcast('DRAWER_TRANSACTION', { transaction });
  }

  public emitDrawerRequestRejected(transaction: CashDrawerTransaction): void {
    this.broadcast('DRAWER_REQUEST_REJECTED', { transaction });
    this.broadcast('DRAWER_TRANSACTION', { transaction });
  }

  public emitStockRequestPending(stockRequest: any): void {
    this.broadcast('STOCK_REQUEST_PENDING', { stockRequest });
    this.broadcast('STOCK_CHANGED', { stockRequest });
  }

  public emitStockRequestApproved(stockRequest: any): void {
    this.broadcast('STOCK_REQUEST_APPROVED', { stockRequest });
    this.broadcast('STOCK_CHANGED', { stockRequest });
  }

  public emitStockRequestRejected(stockRequest: any): void {
    this.broadcast('STOCK_REQUEST_REJECTED', { stockRequest });
    this.broadcast('STOCK_CHANGED', { stockRequest });
  }

  public emitSettingsChanged(settings: SystemSettings): void {
    this.broadcast('SETTINGS_CHANGED', { settings });
  }

  public emitReceiptTemplateChanged(template: ReceiptCustomizationSettings): void {
    this.broadcast('RECEIPT_TEMPLATE_CHANGED', { template });
  }

  public emitStaffChanged(user: User): void {
    this.broadcast('STAFF_CHANGED', { user });
  }

  public emitAttendanceChanged(attendanceRecord: any): void {
    this.broadcast('ATTENDANCE_CHANGED', { attendanceRecord });
  }

  public emitDatabaseSync(key?: string): void {
    this.broadcast('DATABASE_SYNC', { key, timestamp: new Date().toISOString() });
  }
}

export const realtimeSocketService = new RealtimeSocketService();
