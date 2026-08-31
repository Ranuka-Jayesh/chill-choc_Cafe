import { create } from 'zustand';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isPrompt?: boolean;
  defaultValue?: string;
  placeholder?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

export interface PromptDialogOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  resolver: ((value: any) => void) | null;
  inputValue: string;
  setInputValue: (val: string) => void;
  open: (options: ConfirmDialogOptions) => Promise<boolean>;
  openPrompt: (options: PromptDialogOptions) => Promise<string | null>;
  close: (confirmed: boolean, value?: string) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  resolver: null,
  inputValue: '',
  setInputValue: (val: string) => set({ inputValue: val }),

  open: (options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: { ...options, isPrompt: false },
        resolver: resolve,
        inputValue: '',
      });
    });
  },

  openPrompt: (options: PromptDialogOptions) => {
    return new Promise<string | null>((resolve) => {
      set({
        isOpen: true,
        options: { ...options, isPrompt: true },
        resolver: resolve,
        inputValue: options.defaultValue || '',
      });
    });
  },

  close: (confirmed: boolean, value?: string) => {
    const { resolver, options, inputValue } = get();
    const finalValue = value !== undefined ? value : inputValue;

    if (options?.isPrompt) {
      if (confirmed) {
        if (options.onConfirm) options.onConfirm(finalValue);
        if (resolver) resolver(finalValue);
      } else {
        if (options.onCancel) options.onCancel();
        if (resolver) resolver(null);
      }
    } else {
      if (confirmed) {
        if (options?.onConfirm) options.onConfirm();
        if (resolver) resolver(true);
      } else {
        if (options?.onCancel) options.onCancel();
        if (resolver) resolver(false);
      }
    }

    set({
      isOpen: false,
      options: null,
      resolver: null,
      inputValue: '',
    });
  },
}));

/**
 * Programmatic helper to open a confirmation modal anywhere in the app
 * Usage:
 * if (await confirmDialog({ title: 'Clear Cart?', message: 'All items will be removed.' })) { ... }
 */
export const confirmDialog = (options: ConfirmDialogOptions): Promise<boolean> => {
  return useConfirmStore.getState().open(options);
};

/**
 * Programmatic helper to open a custom input prompt modal anywhere in the app
 * Usage:
 * const reason = await promptDialog({ title: 'Refund Order #1045', defaultValue: 'Customer change of mind' });
 */
export const promptDialog = (options: PromptDialogOptions): Promise<string | null> => {
  return useConfirmStore.getState().openPrompt(options);
};
