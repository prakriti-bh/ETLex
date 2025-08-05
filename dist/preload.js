"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var electronAPI = {
    uploadDatabaseSchema: function () { return electron_1.ipcRenderer.invoke('upload-database-schema'); },
    uploadCodeFiles: function () { return electron_1.ipcRenderer.invoke('upload-code-files'); },
    analyzeKPIRequirements: function (description) {
        return electron_1.ipcRenderer.invoke('analyze-kpi-requirements', description);
    },
    generateImprovements: function (analysisData) {
        return electron_1.ipcRenderer.invoke('generate-improvements', analysisData);
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
