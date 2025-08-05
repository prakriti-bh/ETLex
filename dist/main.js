"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var path = require("path");
var DatabaseAnalyzer_1 = require("../src/core/DatabaseAnalyzer");
var CodeAnalyzer_1 = require("../src/core/CodeAnalyzer");
var PrivacyManager_1 = require("../src/core/PrivacyManager");
var LLMOrchestrator_1 = require("../src/core/LLMOrchestrator");
var DataEngineeringApp = /** @class */ (function () {
    function DataEngineeringApp() {
        this.mainWindow = null;
        this.dbAnalyzer = new DatabaseAnalyzer_1.DatabaseAnalyzer();
        this.codeAnalyzer = new CodeAnalyzer_1.CodeAnalyzer();
        this.privacyManager = new PrivacyManager_1.PrivacyManager();
        this.llmOrchestrator = new LLMOrchestrator_1.LLMOrchestrator();
        this.setupIPC();
    }
    DataEngineeringApp.prototype.createWindow = function () {
        this.mainWindow = new electron_1.BrowserWindow({
            width: 1400,
            height: 900,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });
        this.mainWindow.loadFile('dist/index.html');
    };
    DataEngineeringApp.prototype.setupIPC = function () {
        var _this = this;
        // File upload handlers
        electron_1.ipcMain.handle('upload-database-schema', function () { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, electron_1.dialog.showOpenDialog(this.mainWindow, {
                            properties: ['openFile'],
                            filters: [
                                { name: 'Database Files', extensions: ['sql', 'ddl', 'db', 'sqlite'] }
                            ]
                        })];
                    case 1:
                        result = _a.sent();
                        if (!(!result.canceled && result.filePaths.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.analyzeDatabase(result.filePaths[0])];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: return [2 /*return*/, null];
                }
            });
        }); });
        electron_1.ipcMain.handle('upload-code-files', function () { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, electron_1.dialog.showOpenDialog(this.mainWindow, {
                            properties: ['openFile', 'multiSelections'],
                            filters: [
                                { name: 'Code Files', extensions: ['py', 'sql', 'js', 'ts', 'scala', 'java'] }
                            ]
                        })];
                    case 1:
                        result = _a.sent();
                        if (!(!result.canceled && result.filePaths.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.analyzeCodebase(result.filePaths)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: return [2 /*return*/, null];
                }
            });
        }); });
        electron_1.ipcMain.handle('analyze-kpi-requirements', function (_, description) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.analyzeKPIRequirements(description)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); });
        electron_1.ipcMain.handle('generate-improvements', function (_, analysisData) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.generateImprovements(analysisData)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); });
    };
    DataEngineeringApp.prototype.analyzeDatabase = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var schemaData, maskedData, analysis, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.dbAnalyzer.parseSchema(filePath)];
                    case 1:
                        schemaData = _a.sent();
                        return [4 /*yield*/, this.privacyManager.maskSensitiveData(schemaData)];
                    case 2:
                        maskedData = _a.sent();
                        return [4 /*yield*/, this.llmOrchestrator.analyzeDatabase(maskedData)];
                    case 3:
                        analysis = _a.sent();
                        return [2 /*return*/, {
                                schema: maskedData,
                                relationships: analysis.relationships,
                                hierarchy: analysis.hierarchy,
                                recommendations: analysis.recommendations
                            }];
                    case 4:
                        error_1 = _a.sent();
                        console.error('Database analysis failed:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    DataEngineeringApp.prototype.analyzeCodebase = function (filePaths) {
        return __awaiter(this, void 0, void 0, function () {
            var codeAnalysis, maskedAnalysis, llmAnalysis, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.codeAnalyzer.analyzeFiles(filePaths)];
                    case 1:
                        codeAnalysis = _a.sent();
                        return [4 /*yield*/, this.privacyManager.maskSensitiveData(codeAnalysis)];
                    case 2:
                        maskedAnalysis = _a.sent();
                        return [4 /*yield*/, this.llmOrchestrator.analyzeCodebase(maskedAnalysis)];
                    case 3:
                        llmAnalysis = _a.sent();
                        return [2 /*return*/, {
                                codeStructure: maskedAnalysis,
                                dataFlow: llmAnalysis.dataFlow,
                                dependencies: llmAnalysis.dependencies,
                                optimizations: llmAnalysis.optimizations
                            }];
                    case 4:
                        error_2 = _a.sent();
                        console.error('Code analysis failed:', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    DataEngineeringApp.prototype.analyzeKPIRequirements = function (description) {
        return __awaiter(this, void 0, void 0, function () {
            var maskedDescription, analysis, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.privacyManager.maskText(description)];
                    case 1:
                        maskedDescription = _a.sent();
                        return [4 /*yield*/, this.llmOrchestrator.analyzeKPIRequirements(maskedDescription)];
                    case 2:
                        analysis = _a.sent();
                        return [2 /*return*/, {
                                requiredFields: analysis.fields,
                                sourceTables: analysis.tables,
                                joinConditions: analysis.joins,
                                calculations: analysis.calculations,
                                consistencyFields: analysis.consistency
                            }];
                    case 3:
                        error_3 = _a.sent();
                        console.error('KPI analysis failed:', error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    DataEngineeringApp.prototype.generateImprovements = function (analysisData) {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.llmOrchestrator.generateImprovements(analysisData)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_4 = _a.sent();
                        console.error('Improvement generation failed:', error_4);
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return DataEngineeringApp;
}());
var app_instance = new DataEngineeringApp();
electron_1.app.whenReady().then(function () {
    app_instance.createWindow();
});
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', function () {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        app_instance.createWindow();
    }
});
