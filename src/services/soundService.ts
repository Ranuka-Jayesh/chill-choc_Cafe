/**
 * Sound Service for Cashier & POS Audio Feedback
 * Manages automated sounds for Shift Open (Welcome), Order Complete / Receipt, and Shift Close / Logout.
 */
class SoundService {
  private welcomeAudio: HTMLAudioElement | null = null;
  private orderAudio: HTMLAudioElement | null = null;
  private logoutAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.welcomeAudio = new Audio('/welcom.mp3');
        this.orderAudio = new Audio('/order.mp3');
        this.logoutAudio = new Audio('/logout.mp3');

        // Preload metadata
        this.welcomeAudio.preload = 'auto';
        this.orderAudio.preload = 'auto';
        this.logoutAudio.preload = 'auto';
      } catch (e) {
        console.warn('SoundService init error:', e);
      }
    }
  }

  /**
   * Play welcome sound when opening cash drawer & starting shift
   */
  playWelcome() {
    try {
      if (!this.welcomeAudio && typeof window !== 'undefined') {
        this.welcomeAudio = new Audio('/welcom.mp3');
      }
      if (this.welcomeAudio) {
        this.welcomeAudio.currentTime = 0;
        this.welcomeAudio.play().catch((err) => {
          console.warn('Welcome audio play blocked:', err);
        });
      }
    } catch (e) {
      console.warn('playWelcome error:', e);
    }
  }

  /**
   * Play order success sound when order is paid & thermal receipt generated
   */
  playOrderSuccess() {
    try {
      if (!this.orderAudio && typeof window !== 'undefined') {
        this.orderAudio = new Audio('/order.mp3');
      }
      if (this.orderAudio) {
        this.orderAudio.currentTime = 0;
        this.orderAudio.play().catch((err) => {
          console.warn('Order audio play blocked:', err);
        });
      }
    } catch (e) {
      console.warn('playOrderSuccess error:', e);
    }
  }

  /**
   * Play logout sound when shift closing is finalized & cashier logs out
   */
  playLogout() {
    try {
      if (!this.logoutAudio && typeof window !== 'undefined') {
        this.logoutAudio = new Audio('/logout.mp3');
      }
      if (this.logoutAudio) {
        this.logoutAudio.currentTime = 0;
        this.logoutAudio.play().catch((err) => {
          console.warn('Logout audio play blocked:', err);
        });
      }
    } catch (e) {
      console.warn('playLogout error:', e);
    }
  }
}

export const soundService = new SoundService();
