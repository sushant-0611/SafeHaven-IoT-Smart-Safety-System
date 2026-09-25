import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  socket,
  connectSocket,
  disconnectSocket,
} from "../services/socket";

const SocketContext =
  createContext(null);

export function SocketProvider({
  children,
}) {
  const [connected, setConnected] =
    useState(socket.connected);

  useEffect(() => {
    function handleConnect() {
      console.log(
        "[SOCKET] Connected:",
        socket.id
      );

      setConnected(true);
    }

    function handleDisconnect(reason) {
      console.log(
        "[SOCKET] Disconnected:",
        reason
      );

      setConnected(false);
    }

    function handleConnectError(error) {
      console.error(
        "[SOCKET] Connection error:",
        error.message
      );

      setConnected(false);
    }

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "connect_error",
      handleConnectError
    );

    connectSocket();

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "connect_error",
        handleConnectError
      );

      disconnectSocket();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(
    SocketContext
  );
}