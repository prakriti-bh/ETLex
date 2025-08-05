import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  uploadDatabaseSchema: () => ipcRenderer.invoke('upload-database-schema'),
  uploadCodeFiles: () => ipcRenderer.invoke('upload-code-files'),
  analyzeKPIRequirements: (description: string) => 
    ipcRenderer.invoke('analyze-kpi-requirements', description),
  generateImprovements: (analysisData: any) => 
    ipcRenderer.invoke('generate-improvements', analysisData),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);