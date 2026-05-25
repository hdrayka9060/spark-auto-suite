import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ClientCommChannel,
  CommMessage,
  Conversation,
  SendMessageInput,
  ServerCommunicationLog,
  commChannelToServer,
  groupByConversation,
  toClientMessage,
  toServerSendPayload,
} from "@/lib/communication-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const COMM_KEY = ["communication"] as const;

export interface CommFilters {
  channel?: ClientCommChannel | "All";
  linkedVehicleId?: string;
}

export function useCommunicationLogs(filters: CommFilters = {}) {
  const { channel = "All", linkedVehicleId } = filters;
  const serverChannel = channel === "All" ? undefined : commChannelToServer(channel);

  return useQuery({
    queryKey: [...COMM_KEY, "logs", { channel, linkedVehicleId }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerCommunicationLog>>("/communication/logs", {
        query: { channel: serverChannel, linkedVehicle: linkedVehicleId, limit: 200 },
      });
      return {
        ...res,
        messages: res.data.map(toClientMessage),
        conversations: groupByConversation(res.data),
      };
    },
  });
}

export function useChannelStats() {
  return useQuery({
    queryKey: [...COMM_KEY, "stats"],
    queryFn: async () => {
      return api<{ _id: string; count: number; lastSent: string }[]>("/communication/stats");
    },
  });
}

export function useSendCommunication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput): Promise<CommMessage> => {
      const path = `/communication/${commChannelToServer(input.channel)}`;
      const created = await api<ServerCommunicationLog>(path, {
        method: "POST",
        body: toServerSendPayload(input),
      });
      return toClientMessage(created);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: COMM_KEY }),
  });
}

// Re-export for page convenience
export type { Conversation, CommMessage };
