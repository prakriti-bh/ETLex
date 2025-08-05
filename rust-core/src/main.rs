use serde::{Deserialize, Serialize};
use sqlparser::ast::{Statement, DataType, ExactNumberInfo, TimezoneInfo};
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;
use std::collections::HashMap;
use std::io::{self, Read};

#[derive(Serialize, Deserialize, Debug)]
struct ParsedSchema {
    tables: Vec<TableInfo>,
    columns: HashMap<String, Vec<ColumnInfo>>,
    relationships: Vec<Relationship>,
    indexes: Vec<IndexInfo>,
    constraints: Vec<ConstraintInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
struct TableInfo {
    name: String,
    schema: Option<String>,
    table_type: String,
    estimated_rows: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ColumnInfo {
    name: String,
    data_type: String,
    nullable: bool,
    default_value: Option<String>,
    is_primary_key: bool,
    is_foreign_key: bool,
    references: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Relationship {
    from_table: String,
    from_column: String,
    to_table: String,
    to_column: String,
    relationship_type: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct IndexInfo {
    name: String,
    table: String,
    columns: Vec<String>,
    unique: bool,
    index_type: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct ConstraintInfo {
    name: String,
    table: String,
    constraint_type: String,
    columns: Vec<String>,
    reference_table: Option<String>,
    reference_columns: Option<Vec<String>>,
}

struct SQLAnalyzer {
    dialect: GenericDialect,
}

impl SQLAnalyzer {
    fn new() -> Self {
        Self {
            dialect: GenericDialect {},
        }
    }

    fn parse_sql(&self, sql: &str) -> Result<ParsedSchema, Box<dyn std::error::Error>> {
        let mut parsed_schema = ParsedSchema {
            tables: Vec::new(),
            columns: HashMap::new(),
            relationships: Vec::new(),
            indexes: Vec::new(),
            constraints: Vec::new(),
        };

        // Handle multiple statements
        let statements = self.split_statements(sql);
        
        for statement_str in statements {
            if let Ok(parsed) = Parser::parse_sql(&self.dialect, &statement_str) {
                for statement in parsed {
                    self.process_statement(&statement, &mut parsed_schema)?;
                }
            }
        }

        self.infer_relationships(&mut parsed_schema);
        Ok(parsed_schema)
    }

    fn split_statements(&self, sql: &str) -> Vec<String> {
        // Split statements considering quotes and escaped characters
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut in_quote = false;
        let mut in_identifier = false;
        let mut escape = false;
        
        for c in sql.chars() {
            match c {
                '\\' if !escape => escape = true,
                '\'' if !escape && !in_identifier => in_quote = !in_quote,
                '`' if !escape => in_identifier = !in_identifier,
                ';' if !escape && !in_quote && !in_identifier => {
                    if !current.trim().is_empty() {
                        statements.push(current.trim().to_string());
                        current.clear();
                    }
                },
                _ => {
                    if escape && c != '\'' && c != '\\' {
                        current.push('\\');
                    }
                    current.push(c);
                    escape = false;
                }
            }
        }
        
        // Add the last statement if it doesn't end with semicolon
        if !current.trim().is_empty() {
            statements.push(current.trim().to_string());
        }
        
        statements
    }

    fn process_statement(&self, statement: &Statement, schema: &mut ParsedSchema) -> Result<(), Box<dyn std::error::Error>> {
        match statement {
            Statement::CreateTable { name, columns, constraints, .. } => {
                let table_name = name.to_string();
                
                // Add table info
                schema.tables.push(TableInfo {
                    name: table_name.clone(),
                    schema: None,
                    table_type: "TABLE".to_string(),
                    estimated_rows: None,
                });

                // Process columns
                let mut table_columns = Vec::new();
                for column_def in columns {
                    let column_info = ColumnInfo {
                        name: column_def.name.to_string(),
                        data_type: self.data_type_to_string(&column_def.data_type),
                        nullable: !column_def.options.iter().any(|opt| {
                            matches!(opt.option, sqlparser::ast::ColumnOption::NotNull)
                        }),
                        default_value: column_def.options.iter()
                            .find_map(|opt| match &opt.option {
                                sqlparser::ast::ColumnOption::Default(expr) => Some(expr.to_string()),
                                _ => None,
                            }),
                        is_primary_key: column_def.options.iter().any(|opt| {
                            matches!(opt.option, sqlparser::ast::ColumnOption::Unique { 
                                is_primary: true,
                                characteristics: None
                            })
                        }),
                        is_foreign_key: false, // Will be set when processing constraints
                        references: None,
                    };
                    table_columns.push(column_info);
                }
                schema.columns.insert(table_name.clone(), table_columns);

                // Process table constraints
                for constraint in constraints {
                    self.process_table_constraint(constraint, &table_name, schema);
                }
            },
            Statement::CreateIndex { name, table_name, columns, unique, .. } => {
                let index_info = IndexInfo {
                    name: name.as_ref().map(|n| n.to_string()).unwrap_or_else(|| "unnamed_index".to_string()),
                    table: table_name.to_string(),
                    columns: columns.iter().map(|col| col.to_string()).collect(),
                    unique: *unique,
                    index_type: "BTREE".to_string(), // Default assumption
                };
                schema.indexes.push(index_info);
            },
            Statement::AlterTable { name, if_exists: _, only: _, operations } => {
                // Handle ALTER TABLE statements
                self.process_alter_table(name, &operations, schema);
            },
            Statement::CreateView { name, columns, query: _, materialized, .. } => {
                // Handle CREATE VIEW or CREATE MATERIALIZED VIEW
                let table_name = name.to_string();
                let view_type = if *materialized { "MATERIALIZED VIEW" } else { "VIEW" };
                
                schema.tables.push(TableInfo {
                    name: table_name.clone(),
                    schema: None,
                    table_type: view_type.to_string(),
                    estimated_rows: None,
                });

                // Process view columns
                let table_columns: Vec<ColumnInfo> = columns.iter().map(|col| ColumnInfo {
                    name: col.name.to_string(),
                    data_type: "UNKNOWN".to_string(), // Type inference would require query analysis
                    nullable: true,
                    default_value: None,
                    is_primary_key: false,
                    is_foreign_key: false,
                    references: None,
                }).collect();
                schema.columns.insert(table_name, table_columns);
            },
            Statement::Drop { object_type, names, cascade: _, .. } => {
                // Track DROP operations which are important for schema evolution
                for name in names {
                    match object_type {
                        sqlparser::ast::ObjectType::Table => {
                            // Remove table and its relationships
                            schema.tables.retain(|t| t.name != name.to_string());
                            schema.columns.remove(&name.to_string());
                            schema.relationships.retain(|r| {
                                r.from_table != name.to_string() && r.to_table != name.to_string()
                            });
                            schema.indexes.retain(|i| i.table != name.to_string());
                            schema.constraints.retain(|c| c.table != name.to_string());
                        },
                        sqlparser::ast::ObjectType::View => {
                            // Remove view
                            schema.tables.retain(|t| t.name != name.to_string());
                            schema.columns.remove(&name.to_string());
                        },
                        _ => {} // Handle other object types if needed
                    }
                }
            },
            Statement::Truncate { table_name, .. } => {
                // Track TRUNCATE operations which are important for data lifecycle
                if let Some(table) = schema.tables.iter_mut().find(|t| t.name == table_name.to_string()) {
                    table.estimated_rows = Some(0);
                }
            },
            Statement::CreateSchema { schema_name, .. } => {
                // Track schema creation which is important for multi-schema databases
                for table in schema.tables.iter_mut().filter(|t| t.schema.is_none()) {
                    table.schema = Some(schema_name.to_string());
                }
            },
            _ => {
                // Other statements like INSERT, UPDATE, DELETE are tracked at runtime
                // but don't affect the schema structure
            }
        }
        Ok(())
    }

    fn process_table_constraint(&self, constraint: &sqlparser::ast::TableConstraint, table_name: &str, schema: &mut ParsedSchema) {
        match constraint {
            sqlparser::ast::TableConstraint::ForeignKey { 
                name, 
                columns, 
                foreign_table, 
                referred_columns,
                on_delete,
                on_update,
                ..
            } => {
                let mut constraint_type = "FOREIGN KEY".to_string();
                if let Some(action) = on_delete {
                    constraint_type.push_str(&format!(" ON DELETE {}", action));
                }
                if let Some(action) = on_update {
                    constraint_type.push_str(&format!(" ON UPDATE {}", action));
                }
                
                let constraint_info = ConstraintInfo {
                    name: name.as_ref().map(|n| n.to_string()).unwrap_or_else(|| "unnamed_fk".to_string()),
                    table: table_name.to_string(),
                    constraint_type,
                    columns: columns.iter().map(|col| col.to_string()).collect(),
                    reference_table: Some(foreign_table.to_string()),
                    reference_columns: Some(referred_columns.iter().map(|col| col.to_string()).collect()),
                };
                schema.constraints.push(constraint_info);

                // Add relationship
                for (from_col, to_col) in columns.iter().zip(referred_columns.iter()) {
                    let relationship = Relationship {
                        from_table: table_name.to_string(),
                        from_column: from_col.to_string(),
                        to_table: foreign_table.to_string(),
                        to_column: to_col.to_string(),
                        relationship_type: "FOREIGN_KEY".to_string(),
                    };
                    schema.relationships.push(relationship);
                }

                // Update column foreign key status
                if let Some(table_columns) = schema.columns.get_mut(table_name) {
                    for column in table_columns.iter_mut() {
                        if columns.iter().any(|col| col.to_string() == column.name) {
                            column.is_foreign_key = true;
                            column.references = Some(format!("{}.{}", 
                                foreign_table.to_string(),
                                referred_columns.first().map(|c| c.to_string()).unwrap_or_default()
                            ));
                        }
                    }
                }
            },
            sqlparser::ast::TableConstraint::Unique { name, columns, is_primary, characteristics: _ } => {
                let constraint_type = if *is_primary { "PRIMARY KEY" } else { "UNIQUE" };
                let constraint_info = ConstraintInfo {
                    name: name.as_ref().map(|n| n.to_string()).unwrap_or_else(|| 
                        if *is_primary { "unnamed_pk" } else { "unnamed_unique" }.to_string()
                    ),
                    table: table_name.to_string(),
                    constraint_type: constraint_type.to_string(),
                    columns: columns.iter().map(|col| col.to_string()).collect(),
                    reference_table: None,
                    reference_columns: None,
                };
                schema.constraints.push(constraint_info);

                if *is_primary {
                    // Update column primary key status
                    if let Some(table_columns) = schema.columns.get_mut(table_name) {
                        for column in table_columns.iter_mut() {
                            if columns.iter().any(|col| col.to_string() == column.name) {
                                column.is_primary_key = true;
                            }
                        }
                    }
                }
            },
            sqlparser::ast::TableConstraint::Check { name, expr } => {
                // Handle CHECK constraints which are important for data quality rules
                let constraint_info = ConstraintInfo {
                    name: name.as_ref().map(|n| n.to_string()).unwrap_or_else(|| "unnamed_check".to_string()),
                    table: table_name.to_string(),
                    constraint_type: "CHECK".to_string(),
                    columns: vec![], // Check constraints might involve multiple columns or expressions
                    reference_table: None,
                    reference_columns: None,
                };
                schema.constraints.push(constraint_info);

                // Extract column names from the check expression to update the columns array
                if let Some(cols) = self.extract_columns_from_expr(expr) {
                    if let Some(constraint) = schema.constraints.last_mut() {
                        constraint.columns = cols;
                    }
                }
            },

            _ => {
                // Other constraint types like EXCLUDE are database-specific
                // and might need special handling based on the dialect
            }
        }
    }

    fn extract_columns_from_expr(&self, expr: &sqlparser::ast::Expr) -> Option<Vec<String>> {
        let mut columns = Vec::new();
        match expr {
            sqlparser::ast::Expr::Identifier(ident) => {
                columns.push(ident.to_string());
            },
            sqlparser::ast::Expr::CompoundIdentifier(idents) => {
                if let Some(last) = idents.last() {
                    columns.push(last.to_string());
                }
            },
            sqlparser::ast::Expr::BinaryOp { left, right, .. } => {
                if let Some(mut left_cols) = self.extract_columns_from_expr(left) {
                    columns.append(&mut left_cols);
                }
                if let Some(mut right_cols) = self.extract_columns_from_expr(right) {
                    columns.append(&mut right_cols);
                }
            },
            sqlparser::ast::Expr::Nested(nested) => {
                if let Some(mut nested_cols) = self.extract_columns_from_expr(nested) {
                    columns.append(&mut nested_cols);
                }
            },
            sqlparser::ast::Expr::Function(_) => {
                // Function arguments might contain column references
                // but we don't need to extract them for schema analysis
            },
            _ => {} // Handle other expression types if needed
        }
        if !columns.is_empty() {
            Some(columns)
        } else {
            None
        }
    }

    fn process_alter_table(&self, name: &sqlparser::ast::ObjectName, operations: &[sqlparser::ast::AlterTableOperation], schema: &mut ParsedSchema) {
        let table_name = name.to_string();
        
        for operation in operations {
            match operation {
                sqlparser::ast::AlterTableOperation::AddConstraint(constraint) => {
                    // Add new constraint
                    self.process_table_constraint(constraint, &table_name, schema);
                },
                sqlparser::ast::AlterTableOperation::DropConstraint { name, cascade: _, if_exists: _ } => {
                    // Remove constraint and update related information
                    schema.constraints.retain(|c| !(c.table == table_name && c.name == name.to_string()));
                    
                    // Also update column metadata if it was a PK or FK constraint
                    if let Some(cols) = schema.columns.get_mut(&table_name) {
                        for col in cols.iter_mut() {
                            // Reset foreign key info if this was the FK constraint being dropped
                            if col.references.is_some() && schema.constraints.iter().all(|c| 
                                !(c.table == table_name && c.columns.contains(&col.name) && c.constraint_type == "FOREIGN KEY")
                            ) {
                                col.is_foreign_key = false;
                                col.references = None;
                            }
                            
                            // Reset primary key info if this was the PK constraint being dropped
                            if col.is_primary_key && schema.constraints.iter().all(|c| 
                                !(c.table == table_name && c.columns.contains(&col.name) && c.constraint_type == "PRIMARY KEY")
                            ) {
                                col.is_primary_key = false;
                            }
                        }
                    }
                },
                sqlparser::ast::AlterTableOperation::AddColumn { column_def, column_keyword: _, if_not_exists: _ } => {
                    // Add new column to the table
                    if let Some(cols) = schema.columns.get_mut(&table_name) {
                        cols.push(ColumnInfo {
                            name: column_def.name.to_string(),
                            data_type: self.data_type_to_string(&column_def.data_type),
                            nullable: !column_def.options.iter().any(|opt| {
                                matches!(opt.option, sqlparser::ast::ColumnOption::NotNull)
                            }),
                            default_value: column_def.options.iter()
                                .find_map(|opt| match &opt.option {
                                    sqlparser::ast::ColumnOption::Default(expr) => Some(expr.to_string()),
                                    _ => None,
                                }),
                            is_primary_key: column_def.options.iter().any(|opt| {
                                matches!(opt.option, sqlparser::ast::ColumnOption::Unique { 
                                    is_primary: true,
                                    characteristics: None
                                })
                            }),
                            is_foreign_key: false,
                            references: None,
                        });
                    }
                },
                sqlparser::ast::AlterTableOperation::DropColumn { column_name, if_exists: _, cascade: _ } => {
                    // Remove column and its references
                    if let Some(cols) = schema.columns.get_mut(&table_name) {
                        cols.retain(|c| c.name != column_name.to_string());
                    }
                    
                    // Update constraints that reference this column
                    schema.constraints.retain(|c| {
                        !(c.table == table_name && c.columns.contains(&column_name.to_string()))
                    });
                    
                    // Update relationships that reference this column
                    schema.relationships.retain(|r| {
                        !(r.from_table == table_name && r.from_column == column_name.to_string()) &&
                        !(r.to_table == table_name && r.to_column == column_name.to_string())
                    });
                    
                    // Update indexes that reference this column
                    schema.indexes.retain(|i| {
                        !(i.table == table_name && i.columns.contains(&column_name.to_string()))
                    });
                },
                sqlparser::ast::AlterTableOperation::RenameColumn { old_column_name, new_column_name } => {
                    // Update column name in all references
                    if let Some(cols) = schema.columns.get_mut(&table_name) {
                        if let Some(col) = cols.iter_mut().find(|c| c.name == old_column_name.to_string()) {
                            col.name = new_column_name.to_string();
                        }
                    }
                    
                    // Update constraints
                    for constraint in &mut schema.constraints {
                        if constraint.table == table_name {
                            for col in &mut constraint.columns {
                                if *col == old_column_name.to_string() {
                                    *col = new_column_name.to_string();
                                }
                            }
                        }
                    }
                    
                    // Update relationships
                    for rel in &mut schema.relationships {
                        if rel.from_table == table_name && rel.from_column == old_column_name.to_string() {
                            rel.from_column = new_column_name.to_string();
                        }
                        if rel.to_table == table_name && rel.to_column == old_column_name.to_string() {
                            rel.to_column = new_column_name.to_string();
                        }
                    }
                    
                    // Update indexes
                    for index in &mut schema.indexes {
                        if index.table == table_name {
                            for col in &mut index.columns {
                                if *col == old_column_name.to_string() {
                                    *col = new_column_name.to_string();
                                }
                            }
                        }
                    }
                },
                sqlparser::ast::AlterTableOperation::AlterColumn { column_name, op } => {
                    // Handle column modifications
                    if let Some(cols) = schema.columns.get_mut(&table_name) {
                        if let Some(col) = cols.iter_mut().find(|c| c.name == column_name.to_string()) {
                            match op {
                                sqlparser::ast::AlterColumnOperation::SetNotNull => {
                                    col.nullable = false;
                                },
                                sqlparser::ast::AlterColumnOperation::DropNotNull => {
                                    col.nullable = true;
                                },
                                sqlparser::ast::AlterColumnOperation::SetDefault { value } => {
                                    col.default_value = Some(value.to_string());
                                },
                                sqlparser::ast::AlterColumnOperation::DropDefault => {
                                    col.default_value = None;
                                },
                                _ => {} // Other ALTER COLUMN operations
                            }
                        }
                    }
                },
                _ => {} // Other ALTER TABLE operations
            }
        }
    }

    fn data_type_to_string(&self, data_type: &DataType) -> String {
        match data_type {
            DataType::Char(size) => match size {
                Some(length) => format!("CHAR({})", length),
                None => "CHAR".to_string()
            },
            DataType::Varchar(size) => match size {
                Some(length) => format!("VARCHAR({})", length),
                None => "VARCHAR".to_string()
            },
            DataType::Text => "TEXT".to_string(),
            DataType::Int(size) => format!("INT({})", size.unwrap_or(11)),
            DataType::BigInt(size) => format!("BIGINT({})", size.unwrap_or(20)),
            DataType::SmallInt(size) => format!("SMALLINT({})", size.unwrap_or(6)),
            DataType::Float(precision) => format!("FLOAT({})", precision.unwrap_or(24)),
            DataType::Double => "DOUBLE".to_string(),
            DataType::Decimal(info) => {
                let (precision, scale) = match info {
                    ExactNumberInfo::None => (10, 0),
                    ExactNumberInfo::Precision(p) => (*p, 0),
                    ExactNumberInfo::PrecisionAndScale(p, s) => (*p, *s),
                };
                format!("DECIMAL({},{})", precision, scale)
            },
            DataType::Boolean => "BOOLEAN".to_string(),
            DataType::Date => "DATE".to_string(),
            DataType::Time(precision, tz) => {
                let prec_str = precision.map_or("".to_string(), |p| format!("({})", p));
                let tz_str = if matches!(tz, TimezoneInfo::Tz) { " WITH TIME ZONE" } else { "" };
                format!("TIME{}{}", prec_str, tz_str)
            },
            DataType::Timestamp(precision, tz) => {
                let prec_str = precision.map_or("".to_string(), |p| format!("({})", p));
                let tz_str = if matches!(tz, TimezoneInfo::Tz) { " WITH TIME ZONE" } else { "" };
                format!("TIMESTAMP{}{}", prec_str, tz_str)
            },
            DataType::Datetime(precision) => {
                if let Some(p) = precision {
                    format!("DATETIME({})", p)
                } else {
                    "DATETIME".to_string()
                }
            },
            DataType::JSON => "JSON".to_string(),
            DataType::Uuid => "UUID".to_string(),
            _ => "UNKNOWN".to_string(),
        }
    }

    fn infer_relationships(&self, schema: &mut ParsedSchema) {
        // Infer implicit relationships based on naming conventions
        let table_names: Vec<String> = schema.tables.iter().map(|t| t.name.clone()).collect();
        
        for table in &schema.tables {
            if let Some(columns) = schema.columns.get(&table.name) {
                for column in columns {
                    // Check for implicit foreign key relationships
                    if column.name.ends_with("_id") && !column.is_foreign_key {
                        let potential_table = column.name.strip_suffix("_id").unwrap();
                        
                        // Check if there's a table with this name or similar
                        for target_table in &table_names {
                            if target_table.to_lowercase() == potential_table.to_lowercase() ||
                               target_table.to_lowercase() == format!("{}s", potential_table.to_lowercase()) ||
                               target_table.to_lowercase() == format!("{}es", potential_table.to_lowercase()) {
                                
                                // Find primary key of target table
                                if let Some(target_columns) = schema.columns.get(target_table) {
                                    if let Some(pk_column) = target_columns.iter().find(|c| c.is_primary_key) {
                                        let relationship = Relationship {
                                            from_table: table.name.clone(),
                                            from_column: column.name.clone(),
                                            to_table: target_table.clone(),
                                            to_column: pk_column.name.clone(),
                                            relationship_type: "INFERRED_FK".to_string(),
                                        };
                                        schema.relationships.push(relationship);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    
    let analyzer = SQLAnalyzer::new();
    match analyzer.parse_sql(&input) {
        Ok(schema) => {
            let json_output = serde_json::to_string_pretty(&schema)?;
            println!("{}", json_output);
        },
        Err(e) => {
            eprintln!("Error parsing SQL: {}", e);
            std::process::exit(1);
        }
    }
    
    Ok(())
}