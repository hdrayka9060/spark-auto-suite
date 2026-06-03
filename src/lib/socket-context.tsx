import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { BACKEND_ORIGIN, tokenStorage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { MESSAGING_KEY } from "@/hooks/api/use-messaging";

/**
 * App-wide Socket.io connection for staff chat. Connects only while
 * authenticated. The server pushes message/conversation events; we react by
 * invalidating the relevant TanStack Query keys so the open chat, the
 * conversation list, and the unread badge all refresh in real time. (We don't
 * trust the pushed payload's `isMine` — the refetch re-derives it per-user.)
 */
interface SocketCtx {
  connected: boolean;
}

const SocketContext = createContext<SocketCtx>({ connected: false });
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const authed = state.status === "authenticated";
  const userId = authed ? state.user._id : null;

  useEffect(() => {
    if (!authed) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(BACKEND_ORIGIN, {
      // `auth` as a function → every (re)connection reads the freshest stored
      // access token, so it survives a token refresh.
      auth: (cb) => cb({ token: tokenStorage.getAccess() ?? "" }),
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    const refreshConversations = () => {
      qc.invalidateQueries({ queryKey: [...MESSAGING_KEY, "conversations"] });
      qc.invalidateQueries({ queryKey: [...MESSAGING_KEY, "unread"] });
    };
    const refreshMessages = (payload: { conversationId?: string }) => {
      if (payload?.conversationId) {
        qc.invalidateQueries({ queryKey: [...MESSAGING_KEY, "messages", payload.conversationId] });
      }
      refreshConversations();
    };

    socket.on("message:new", refreshMessages);
    socket.on("message:edited", refreshMessages);
    socket.on("message:deleted", refreshMessages);
    socket.on("conversation:updated", refreshConversations);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [authed, userId, qc]);

  return <SocketContext.Provider value={{ connected }}>{children}</SocketContext.Provider>;
}
