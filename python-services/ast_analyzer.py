import ast
import json
import sys
import re
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
import sqlparse
from sqlparse.sql import IdentifierList, Identifier, Function, Parenthesis
from sqlparse.tokens import Keyword, DML

@dataclass
class FunctionInfo:
    name: str
    args: List[str]
    returns: Optional[str]
    line_number: int
    docstring: Optional[str]
    decorators: List[str]
    calls_made: List[str]
    sql_queries: List[str]
    data_operations: List[str]

@dataclass
class ClassInfo:
    name: str
    methods: List[FunctionInfo]
    attributes: List[str]
    inheritance: List[str]
    line_number: int
    docstring: Optional[str]

@dataclass
class ImportInfo:
    module: str
    names: List[str]
    alias: Optional[str]
    line_number: int

@dataclass
class DataOperation:
    operation_type: str
    target: str
    method: str
    line_number: int
    context: str

@dataclass
class SQLQuery:
    query: str
    query_type: str
    tables: List[str]
    columns: List[str]
    line_number: int
    context: str

@dataclass
class AnalysisResult:
    file_path: str
    functions: List[FunctionInfo]
    classes: List[ClassInfo]
    imports: List[ImportInfo]
    global_variables: List[str]
    data_operations: List[DataOperation]
    sql_queries: List[SQLQuery]
    complexity_metrics: Dict[str, Any]
    dependencies: List[str]

class PythonASTAnalyzer:
    def __init__(self):
        self.sql_patterns = [
            re.compile(r'SELECT\s+.*?FROM\s+\w+', re.IGNORECASE | re.DOTALL),
            re.compile(r'INSERT\s+INTO\s+\w+', re.IGNORECASE),
            re.compile(r'UPDATE\s+\w+\s+SET', re.IGNORECASE),
            re.compile(r'DELETE\s+FROM\s+\w+', re.IGNORECASE),
            re.compile(r'CREATE\s+TABLE\s+\w+', re.IGNORECASE),
            re.compile(r'DROP\s+TABLE\s+\w+', re.IGNORECASE),
        ]
        
        self.data_operation_patterns = {
            'pandas': ['read_csv', 'read_sql', 'read_json', 'to_csv', 'to_sql', 'merge', 'join', 'groupby', 'pivot'],
            'numpy': ['array', 'reshape', 'transpose', 'dot', 'concatenate'],
            'spark': ['read', 'write', 'select', 'filter', 'groupBy', 'join', 'union'],
            'database': ['execute', 'fetchall', 'fetchone', 'commit', 'rollback']
        }

    def analyze_file(self, file_path: str, content: str) -> AnalysisResult:
        try:
            tree = ast.parse(content)
            
            visitor = ASTVisitor()
            visitor.visit(tree)
            
            # Extract SQL queries from string literals
            sql_queries = self.extract_sql_queries(content)
            
            # Calculate complexity metrics
            complexity_metrics = self.calculate_complexity_metrics(tree, content)
            
            # Identify dependencies
            dependencies = self.identify_dependencies(visitor.imports)
            
            return AnalysisResult(
                file_path=file_path,
                functions=visitor.functions,
                classes=visitor.classes,
                imports=visitor.imports,
                global_variables=visitor.global_variables,
                data_operations=visitor.data_operations,
                sql_queries=sql_queries,
                complexity_metrics=complexity_metrics,
                dependencies=dependencies
            )
            
        except SyntaxError as e:
            # Handle syntax errors gracefully
            return AnalysisResult(
                file_path=file_path,
                functions=[],
                classes=[],
                imports=[],
                global_variables=[],
                data_operations=[],
                sql_queries=[],
                complexity_metrics={'error': str(e)},
                dependencies=[]
            )

    def extract_sql_queries(self, content: str) -> List[SQLQuery]:
        queries = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            for pattern in self.sql_patterns:
                matches = pattern.findall(line)
                for match in matches:
                    query_info = self.analyze_sql_query(match)
                    queries.append(SQLQuery(
                        query=match.strip(),
                        query_type=query_info['type'],
                        tables=query_info['tables'],
                        columns=query_info['columns'],
                        line_number=i + 1,
                        context=line.strip()
                    ))
        
        return queries

    def analyze_sql_query(self, query: str) -> Dict[str, Any]:
        try:
            parsed = sqlparse.parse(query)[0]
            
            query_type = 'UNKNOWN'
            tables = []
            columns = []
            
            # Determine query type
            for token in parsed.tokens:
                if token.ttype is DML:
                    query_type = token.value.upper()
                    break
            
            # Extract tables and columns
            tables, columns = self.extract_tables_and_columns(parsed)
            
            return {
                'type': query_type,
                'tables': tables,
                'columns': columns
            }
        except Exception:
            return {
                'type': 'UNKNOWN',
                'tables': [],
                'columns': []
            }

    def extract_tables_and_columns(self, parsed) -> tuple:
        tables = []
        columns = []
        
        def extract_from_token(token):
            if isinstance(token, IdentifierList):
                for identifier in token.get_identifiers():
                    if hasattr(identifier, 'get_name'):
                        tables.append(identifier.get_name())
            elif isinstance(token, Identifier):
                if hasattr(token, 'get_name'):
                    tables.append(token.get_name())
            elif hasattr(token, 'tokens'):
                for subtoken in token.tokens:
                    extract_from_token(subtoken)
        
        for token in parsed.tokens:
            extract_from_token(token)
        
        return list(set(tables)), list(set(columns))

    def calculate_complexity_metrics(self, tree: ast.AST, content: str) -> Dict[str, Any]:
        lines = content.split('\n')
        
        return {
            'lines_of_code': len([line for line in lines if line.strip() and not line.strip().startswith('#')]),
            'total_lines': len(lines),
            'comment_lines': len([line for line in lines if line.strip().startswith('#')]),
            'function_count': len([node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]),
            'class_count': len([node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]),
            'cyclomatic_complexity': self.calculate_cyclomatic_complexity(tree),
            'import_count': len([node for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom))]),
        }

    def calculate_cyclomatic_complexity(self, tree: ast.AST) -> int:
        complexity = 1  # Base complexity
        
        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(node, ast.ExceptHandler):
                complexity += 1
            elif isinstance(node, ast.With):
                complexity += 1
            elif isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
                complexity += 1
        
        return complexity

    def identify_dependencies(self, imports: List[ImportInfo]) -> List[str]:
        dependencies = set()
        
        for import_info in imports:
            dependencies.add(import_info.module.split('.')[0])
            
        return list(dependencies)

class ASTVisitor(ast.NodeVisitor):
    def __init__(self):
        self.functions: List[FunctionInfo] = []
        self.classes: List[ClassInfo] = []
        self.imports: List[ImportInfo] = []
        self.global_variables: List[str] = []
        self.data_operations: List[DataOperation] = []
        self.current_class: Optional[str] = None
        
        self.data_libs = ['pandas', 'pd', 'numpy', 'np', 'spark', 'pyspark']

    def visit_FunctionDef(self, node: ast.FunctionDef):
        # Extract function information
        args = [arg.arg for arg in node.args.args]
        returns = ast.unparse(node.returns) if node.returns else None
        docstring = ast.get_docstring(node)
        decorators = [ast.unparse(dec) for dec in node.decorator_list]
        
        # Analyze function body for calls and data operations
        calls_made = []
        sql_queries = []
        data_operations = []
        
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name):
                    calls_made.append(child.func.id)
                elif isinstance(child.func, ast.Attribute):
                    call_name = ast.unparse(child.func)
                    calls_made.append(call_name)
                    
                    # Check for data operations
                    if any(lib in call_name for lib in self.data_libs):
                        data_operations.append(call_name)
            
            elif isinstance(child, ast.Str):
                # Check for SQL in string literals
                if any(keyword in child.s.upper() for keyword in ['SELECT', 'INSERT', 'UPDATE', 'DELETE']):
                    sql_queries.append(child.s)

        func_info = FunctionInfo(
            name=node.name,
            args=args,
            returns=returns,
            line_number=node.lineno,
            docstring=docstring,
            decorators=decorators,
            calls_made=list(set(calls_made)),
            sql_queries=sql_queries,
            data_operations=list(set(data_operations))
        )
        
        if self.current_class:
            # This is a method, will be added to class
            pass
        else:
            self.functions.append(func_info)
        
        self.generic_visit(node)
        return func_info

    def visit_ClassDef(self, node: ast.ClassDef):
        old_class = self.current_class
        self.current_class = node.name
        
        methods = []
        attributes = []
        inheritance = [ast.unparse(base) for base in node.bases]
        docstring = ast.get_docstring(node)
        
        # Visit all methods and attributes
        for child in node.body:
            if isinstance(child, ast.FunctionDef):
                method_info = self.visit_FunctionDef(child)
                methods.append(method_info)
            elif isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name):
                        attributes.append(target.id)

        class_info = ClassInfo(
            name=node.name,
            methods=methods,
            attributes=attributes,
            inheritance=inheritance,
            line_number=node.lineno,
            docstring=docstring
        )
        
        self.classes.append(class_info)
        self.current_class = old_class
        
        # Don't call generic_visit to avoid duplicate processing

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            import_info = ImportInfo(
                module=alias.name,
                names=[alias.name],
                alias=alias.asname,
                line_number=node.lineno
            )
            self.imports.append(import_info)
        
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            names = [alias.name for alias in node.names]
            import_info = ImportInfo(
                module=node.module,
                names=names,
                alias=None,
                line_number=node.lineno
            )
            self.imports.append(import_info)
        
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign):
        # Track global variable assignments
        if not self.current_class:
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self.global_variables.append(target.id)
        
        # Check for data operations in assignments
        if isinstance(node.value, ast.Call):
            if isinstance(node.value.func, ast.Attribute):
                call_name = ast.unparse(node.value.func)
                if any(lib in call_name for lib in self.data_libs):
                    operation = DataOperation(
                        operation_type='assignment',
                        target=ast.unparse(node.targets[0]) if node.targets else 'unknown',
                        method=call_name,
                        line_number=node.lineno,
                        context=ast.unparse(node)
                    )
                    self.data_operations.append(operation)
        
        self.generic_visit(node)

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        file_path = input_data['filePath']
        content = input_data['content']
        
        analyzer = PythonASTAnalyzer()
        result = analyzer.analyze_file(file_path, content)
        
        # Convert to dict and output as JSON
        output = asdict(result)
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'file_path': 'unknown',
            'functions': [],
            'classes': [],
            'imports': [],
            'global_variables': [],
            'data_operations': [],
            'sql_queries': [],
            'complexity_metrics': {},
            'dependencies': []
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()