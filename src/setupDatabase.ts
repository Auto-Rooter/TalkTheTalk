import mongoose from 'mongoose';
import Logger from 'bunyan';
import {config} from './config'; 

const log: Logger = config.createLogger('setupDatabase'); // Just identifier

export default () => {
    const connect = () => {
        mongoose.connect(`${config.DATABASE_URL}`)
            .then(() => {
                log.info('[+] Successfully connected to database...');
            })
            .catch((error) => {
                log.error('[x] Error connecting to database', error);
                return process.exit(1);
            });
    };
    connect();
    mongoose.connection.on('[*] MongoDb disconnected, trying to reconnect...', connect);
};