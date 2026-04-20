import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const defaultState = {
  ships: [],
  berths: [],
  containers: 0,
  tickMs: 2000,
  decision: {
    congestionScore: 0,
    berthUtilizationPercent: 0,
    waitingShips: 0,
    predictedCongestion15m: 0,
    predictionLabel: 'low',
  },
};

/**
 * Live connection to DockPulse backend (Socket.io).
 * Proxied via Vite in dev → http://localhost:3000
 */
export function useWebSocket(url = undefined) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(defaultState);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);

  const connectUrl = url ?? (import.meta.env.VITE_SOCKET_URL || '');

  useEffect(() => {
    const socket = io(connectUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('port:state', (payload) => {
      setState((prev) => ({ ...prev, ...payload }));
    });

    socket.on('port:event', (msg) => {
      setLastEvent(msg);
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [connectUrl]);

  const reconnect = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  return {
    connected,
    state,
    lastEvent,
    socket: socketRef,
    reconnect,
  };
}
