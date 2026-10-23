import { contextBridge, ipcRenderer } from 'electron'
import type { LiveClientRosterResult } from '../shared/live-client-data'

type LeagueWindow = {
  id: string
  name: string
}

contextBridge.exposeInMainWorld('companion', {
  version: '0.1.0',
  setOverlayActive: (active: boolean): Promise<void> =>
    ipcRenderer.invoke('overlay:set-active', active),
  publishOverlayAlert: (title: string): void =>
    ipcRenderer.send('overlay:publish-alert', title),
  notifyOverlayReady: (): void => ipcRenderer.send('overlay:ready'),
  onOverlayAlert: (callback: (title: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, title: string): void => callback(title)
    ipcRenderer.on('overlay:alert', listener)
    return () => ipcRenderer.removeListener('overlay:alert', listener)
  },
  findLeagueWindows: (): Promise<LeagueWindow[]> =>
    ipcRenderer.invoke('capture:list-league-windows'),
  selectLeagueWindow: (sourceId: string): Promise<boolean> =>
    ipcRenderer.invoke('capture:select-league-window', sourceId),
  readLiveClientRoster: (): Promise<LiveClientRosterResult> =>
    ipcRenderer.invoke('live-client:read-roster'),
  initializeGameOcr: (): Promise<boolean> =>
    ipcRenderer.invoke('game-ocr:initialize'),
  readGameClock: (image: Uint8Array): Promise<{ text: string; confidence: number }> =>
    ipcRenderer.invoke('game-ocr:read-clock', image),
  saveDiagnosticSample: (sample: {
    manifest: string
    images: Record<string, string>
  }): Promise<string | null> => ipcRenderer.invoke('diagnostics:save-sample', sample),
  stopGameOcr: (): Promise<void> =>
    ipcRenderer.invoke('game-ocr:stop')
})
