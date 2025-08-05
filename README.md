# Data Engineering Analysis Desktop App

A privacy-first desktop application for comprehensive data engineering analysis using lightweight AI models.

## Features

### 🔒 Privacy-First Design
- All data processing happens locally
- No external API calls for sensitive data
- Built-in PII detection and masking
- Configurable privacy controls

### 📊 Database Analysis
- SQL/DDL schema parsing using Rust for performance
- Automatic relationship detection
- Table hierarchy visualization
- Performance optimization suggestions

### 💻 Code Analysis
- Multi-language support (Python, SQL, JavaScript, TypeScript, Scala, Java)
- AST-based analysis for deep code understanding
- Data flow visualization
- Dependency mapping
- Cross-file analysis

### 📈 KPI Analysis
- Natural language requirement processing
- Automatic field mapping suggestions
- Join condition generation
- Calculation logic recommendations

### 🤖 AI-Powered Insights
- Local LLM integration (CodeLlama/similar)
- Generic analysis patterns (no hardcoded scenarios)
- Performance optimization suggestions
- Architecture improvement recommendations

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Electron UI   │    │   TypeScript    │    │   Privacy       │
│   (Frontend)    │◄──►│   Main Process  │◄──►│   Manager       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼─────┐ ┌───────▼─────┐ ┌───────▼─────┐
        │    Rust     │ │   Python    │ │   Local     │
        │ SQL Parser  │ │ AST Analyzer│ │ LLM Service │
        └─────────────┘ └─────────────┘ └─────────────┘
```

## Installation

### Prerequisites
- Node.js 18+
- Python 3.8+
- Rust 1.70+
- Docker (for LLM service)

### Setup

1. **Clone and install dependencies:**
```bash
git clone <repository>
cd data-engineering-analyzer
npm install
```

2. **Build Rust SQL parser:**
```bash
cd rust-core
cargo build --release
cd ..
```

3. **Setup Python environment:**
```bash
cd python-services
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

4. **Start LLM service:**
```bash
docker-compose up -d
```

5. **Build and run the application:**
```bash
npm run build
npm start
```

## Usage

### Database Analysis
1. Click on "Database Analysis" tab
2. Upload your SQL/DDL files or SQLite databases
3. View automatically generated:
   - Table relationships
   - Data hierarchy
   - Performance recommendations

### Code Analysis
1. Switch to "Code Analysis" tab
2. Upload your data pipeline code files
3. Analyze:
   - Code structure and complexity
   - Data flow between components
   - Optimization opportunities

### KPI Analysis
1. Go to "KPI Analysis" tab
2. Describe your KPI requirements in natural language
3. Get:
   - Required field mappings
   - Source table recommendations
   - Join conditions and calculation logic

## Configuration

### Privacy Settings
Edit `src/core/PrivacyManager.ts` to customize:
- PII detection patterns
- Masking strategies
- Data retention policies

### LLM Configuration
Modify `docker-compose.yml` to:
- Change model (default: CodeLlama 7B)
- Adjust memory limits
- Configure model parameters

### Performance Tuning
- Rust parser: Edit `rust-core/src/main.rs`
- Python analyzer: Modify `python-services/ast_analyzer.py`
- Frontend: Adjust `src/main.ts` settings

## Security Features

1. **Local Processing**: All analysis happens on your machine
2. **PII Masking**: Automatic detection and redaction of sensitive data
3. **Rate Limiting**: Built-in protection against excessive requests
4. **Input Sanitization**: All inputs are sanitized before processing
5. **No Data Persistence**: Analysis results are session-only

## Troubleshooting

### Common Issues

**LLM Service Not Starting:**
```bash
docker-compose logs llm-service
# Check if model download completed
```

**Rust Parser Fails:**
```bash
cd rust-core
cargo clean
cargo build --release
```

**Python Analysis Errors:**
```bash
cd python-services
pip install -r requirements.txt --force-reinstall
```

**Frontend Not Loading:**
```bash
npm run build
# Check dist/ directory exists
```

## Development

### Building Components

**TypeScript/Electron:**
```bash
npm run build
```

**Rust Parser:**
```bash
cd rust-core && cargo build --release
```

**Python Services:**
```bash
cd python-services && python -m pytest tests/
```