import { DbConfig } from "src/common";
import { DataSource, DataSourceOptions } from "typeorm";

export const dataSourceOptions: DataSourceOptions = {
    type: 'mysql' ,
    host: DbConfig.data_source_host,
    port: DbConfig.data_source_port,
    username: DbConfig.data_source_username,
    password: DbConfig.data_source_password,
    database: DbConfig.data_source_database,
    entities: ['dist/**/*.entity.js'],
    synchronize: false,
    migrations: [
        'dist/db/migrations/*.js'
    ],
    // logging: true,
}
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;