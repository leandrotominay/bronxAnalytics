import { contextBridge, ipcRenderer } from 'electron'
import type { LiveClientJunglerResult } from '../shared/live-client-data'
import type { ChampionFullClear } from '../shared/full-clear'
import type { OverlayMarker } from '../shared/overlay'
import type { RiotSyncRequest, RiotSyncResponse } from '../shared/riot-sync'

type LeagueWindow = {
  id: string
  name: string
}

contextBridge.exposeInMainWorld('companion', {
  version: '0.1.0',
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  setOverlayActive: (active: boolean): Promise<void> =>
    ipcRenderer.invoke('overlay:set-active', active),
  setOverlayMarker: (marker: OverlayMarker | null): Promise<void> =>
    ipcRenderer.invoke('overlay:set-marker', marker),
  publishOverlayAlert: (title: string): void =>
    ipcRenderer.send('overlay:publish-alert', title),
  notifyOverlayReady: (): void => ipcRenderer.send('overlay:ready'),
  onOverlayMarker: (callback: (marker: OverlayMarker | null) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, marker: OverlayMarker | null): void =>
      callback(marker)
    ipcRenderer.on('overlay:marker', listener)
    return () => ipcRenderer.removeListener('overlay:marker', listener)
  },
  onOverlayAlert: (callback: (title: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, title: string): void => callback(title)
    ipcRenderer.on('overlay:alert', listener)
    return () => ipcRenderer.removeListener('overlay:alert', listener)
  },
  findLeagueWindows: (): Promise<LeagueWindow[]> =>
    ipcRenderer.invoke('capture:list-league-windows'),
  selectLeagueWindow: (sourceId: string): Promise<boolean> =>
    ipcRenderer.invoke('capture:select-league-window', sourceId),
  readLiveClientJungler: (): Promise<LiveClientJunglerResult> =>
    ipcRenderer.invoke('live-client:read-jungler'),
  readChampionFullClear: (championName: string): Promise<ChampionFullClear | null> =>
    ipcRenderer.invoke('full-clear:read-benchmark', championName),
  syncRiotRankedMatches: (request: RiotSyncRequest): Promise<RiotSyncResponse> =>
    ipcRenderer.invoke('riot:sync-ranked-matches', request),
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
