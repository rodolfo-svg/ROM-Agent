import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function initializeSocket(userId: string, token: string) {
  if (socket) {
    socket.disconnect();
  }

  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    auth: {
      userId,
      token
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
