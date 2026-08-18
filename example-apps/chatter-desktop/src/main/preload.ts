import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type ConversationSummary,
  type MessageView,
  type StatusView,
} from "./ipc-types.js";

/**
 * The only surface the renderer gets — no direct Node/Electron access (contextIsolation +
 * nodeIntegration: false). Nothing here ever exposes a raw attachment download URL; see
 * ipc-types.ts's MessageView and attachment-utils.ts's comments for why. Likewise, the
 * renderer only ever handles opaque conversationKey strings, never a real Conversation object
 * — see index.ts's resolveConversation() comment.
 */
contextBridge.exposeInMainWorld("chatterAPI", {
  onMessage: (callback: (message: MessageView) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.message, (_event, message: MessageView) => {
      callback(message);
    });
  },
  onStatus: (callback: (status: StatusView) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.status, (_event, status: StatusView) => {
      callback(status);
    });
  },
  onConversations: (callback: (conversations: ConversationSummary[]) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.conversations, (_event, conversations: ConversationSummary[]) => {
      callback(conversations);
    });
  },
  sendText: (conversationKey: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.sendText, conversationKey, text),
  pickAttachment: (conversationKey: string, caption: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.pickAttachment, conversationKey, caption),
  openAttachment: (messageId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.openAttachment, messageId),
});
