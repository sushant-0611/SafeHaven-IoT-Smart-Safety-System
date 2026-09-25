import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
});

export function connectSocket() {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export function subscribeToDevice(deviceId) {
  if (!deviceId) return;

  socket.emit(
    "device:subscribe",
    deviceId
  );
}

export function unsubscribeFromDevice(deviceId) {
  if (!deviceId) return;

  socket.emit(
    "device:unsubscribe",
    deviceId
  );
}