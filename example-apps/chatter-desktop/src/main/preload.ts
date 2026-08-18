import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type MessageView, type StatusView } from "./ipc-types.js";

/**
 * The only surface the renderer gets — no direct Node/Electron access (contextIsolation +
 * nodeIntegration: false). Nothing here ever exposes a raw attachment download URL; see
 * ipc-types.ts's MessageView and attachment-utils.ts's comments for why.
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
  sendText: (text: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.sendText, text),
  pickAttachment: (caption: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.pickAttachment, caption),
  openAttachment: (messageId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.openAttachment, messageId),
});
