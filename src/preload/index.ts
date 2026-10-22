import { contextBridge, ipcRenderer } from 'electron'

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
  onOverlayAlert: (callback: (title: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, title: string): void => callback(title)
    ipcRenderer.on('overlay:alert', listener)
    return () => ipcRenderer.removeListener('overlay:alert', listener)
  },
  findLeagueWindows: (): Promise<LeagueWindow[]> =>
    ipcRenderer.invoke('capture:list-league-windows'),
  selectLeagueWindow: (sourceId: string): Promise<boolean> =>
    ipcRenderer.invoke('capture:select-league-window', sourceId),
  initializeGameOcr: (): Promise<boolean> =>
    ipcRenderer.invoke('game-ocr:initialize'),
  readGameClock: (image: Uint8Array): Promise<{ text: string; confidence: number }> =>
    ipcRenderer.invoke('game-ocr:read-clock', image),
  readScoreboard: (image: Uint8Array): Promise<{ text: string; confidence: number }> =>
    ipcRenderer.invoke('game-ocr:read-scoreboard', image),
  stopGameOcr: (): Promise<void> =>
    ipcRenderer.invoke('game-ocr:stop')
})
