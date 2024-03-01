from sqlalchemy import create_engine, select, Table
from sqlalchemy.orm import declarative_base
# MySQL database connection
mysql_url = "mysql+mysqlconnector://ggsys:12GGsysGG21@localhost:3306/GGsystem"
mysql_engine = create_engine(mysql_url)

# SQLite database connection
sqlite_url = "sqlite:///app.db"
sqlite_engine = create_engine(sqlite_url)
Base = declarative_base()


def migrate_data():
    # Connect to MySQL database
    mysql_conn = mysql_engine.connect()
    
    # Connect to SQLite database
    sqlite_conn = sqlite_engine.connect()

    # Define tables to migrate
    tables_to_migrate = ['grupos', 'tipos_pagos', 'aseguradoras', 'ramos', 'subramos', 'agentes', 
                         'clientes', 'polizas', 'recibos', 'servicios', 'niveles_acceso', 'accesos', 
                         'usuarios', 'solicitudes_new_pass']

    for table_name in tables_to_migrate:
        # Reflect table metadata from MySQL
        mysql_table = Table(table_name, Base.metadata, autoload_with=mysql_engine)

        # Reflect table metadata from SQLite
        sqlite_table = Table(table_name, Base.metadata, autoload_with=sqlite_engine)

        # Query data from MySQL
        mysql_data = mysql_conn.execute(select(mysql_table))

        # Insert data into SQLite
        for row in mysql_data:
            row_dict = {mysql_table.columns[i].name: row[i] for i in range(len(row))}
            sqlite_conn.execute(sqlite_table.insert().values(**row_dict))


    # Close connections
    sqlite_conn.commit()
    mysql_conn.close()
    sqlite_conn.close()

if __name__ == "__main__":
    migrate_data()
