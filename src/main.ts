import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { DatabaseAnalyzer } from './core/DatabaseAnalyzer';
import { CodeAnalyzer } from './core/CodeAnalyzer';
import { PrivacyManager } from './core/PrivacyManager';
import { LLMOrchestrator } from './core/LLMOrchestrator';

class DataEngineeringApp {
  private mainWindow: BrowserWindow | null = null;
  private dbAnalyzer: DatabaseAnalyzer;
  private codeAnalyzer: CodeAnalyzer;
  private privacyManager: PrivacyManager;
  private llmOrchestrator: LLMOrchestrator;

  constructor() {
    this.dbAnalyzer = new DatabaseAnalyzer();
    this.codeAnalyzer = new CodeAnalyzer();
    this.privacyManager = new PrivacyManager();
    this.llmOrchestrator = new LLMOrchestrator();
    
    this.setupIPC();
  }

  createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    this.mainWindow.loadFile('dist/index.html');
  }

  private setupIPC(): void {
    // File upload handlers
    ipcMain.handle('upload-database-schema', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: [
          { name: 'Database Files', extensions: ['sql', 'ddl', 'db', 'sqlite'] }
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        return await this.analyzeDatabase(result.filePaths[0]);
      }
      return null;
    });

    ipcMain.handle('upload-code-files', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Code Files', extensions: ['py', 'sql', 'js', 'ts', 'scala', 'java'] }
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        return await this.analyzeCodebase(result.filePaths);
      }
      return null;
    });

    ipcMain.handle('analyze-kpi-requirements', async (_, description: string) => {
      return await this.analyzeKPIRequirements(description);
    });

    ipcMain.handle('generate-improvements', async (_, analysisData: any) => {
      return await this.generateImprovements(analysisData);
    });
  }

  private async analyzeDatabase(filePath: string): Promise<any> {
    try {
      // Parse database schema
      const schemaData = await this.dbAnalyzer.parseSchema(filePath);
      
      // Apply privacy masking
      const maskedData = await this.privacyManager.maskSensitiveData(schemaData);
      
      // Generate relationships and hierarchy
      const analysis = await this.llmOrchestrator.analyzeDatabase(maskedData);
      
      return {
        schema: maskedData,
        relationships: analysis.relationships,
        hierarchy: analysis.hierarchy,
        recommendations: analysis.recommendations
      };
    } catch (error) {
      console.error('Database analysis failed:', error);
      throw error;
    }
  }

  private async analyzeCodebase(filePaths: string[]): Promise<any> {
    try {
      const codeAnalysis = await this.codeAnalyzer.analyzeFiles(filePaths);
      const maskedAnalysis = await this.privacyManager.maskSensitiveData(codeAnalysis);
      
      const llmAnalysis = await this.llmOrchestrator.analyzeCodebase(maskedAnalysis);
      
      return {
        codeStructure: maskedAnalysis,
        dataFlow: llmAnalysis.dataFlow,
        dependencies: llmAnalysis.dependencies,
        optimizations: llmAnalysis.optimizations
      };
    } catch (error) {
      console.error('Code analysis failed:', error);
      throw error;
    }
  }

  private async analyzeKPIRequirements(description: string): Promise<any> {
    try {
      const maskedDescription = await this.privacyManager.maskText(description);
      const analysis = await this.llmOrchestrator.analyzeKPIRequirements(maskedDescription);
      
      return {
        requiredFields: analysis.fields,
        sourceTables: analysis.tables,
        joinConditions: analysis.joins,
        calculations: analysis.calculations,
        consistencyFields: analysis.consistency
      };
    } catch (error) {
      console.error('KPI analysis failed:', error);
      throw error;
    }
  }

  private async generateImprovements(analysisData: any): Promise<any> {
    try {
      return await this.llmOrchestrator.generateImprovements(analysisData);
    } catch (error) {
      console.error('Improvement generation failed:', error);
      throw error;
    }
  }
}

const app_instance = new DataEngineeringApp();

app.whenReady().then(() => {
  app_instance.createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    app_instance.createWindow();
  }
});