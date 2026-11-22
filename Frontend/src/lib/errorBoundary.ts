export interface ErrorState {
  hasError: boolean;
  message: string;
  timestamp: number;
}

export function createErrorState(error: unknown): ErrorState {
  return {
    hasError: true,
    message: formatErrorMessage(error),
    timestamp: Date.now(),
  };
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'Terjadi kendala tidak terduga';
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return 'Terjadi kendala tidak terduga';
}
