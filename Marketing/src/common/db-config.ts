
export const DbConfig = {
    /**
     * 
     */
    data_source_type: 'mysql',
    data_source_host: process.env.DB_HOST,
    data_source_port: +process.env.DB_PORT,
    data_source_username: process.env.DB_USERNAME,
    data_source_password: process.env.DB_PASSWORD,
    data_source_database: process.env.DB_DATABASE,
}