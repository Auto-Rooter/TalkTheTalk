import express, {Express} from 'express';
import dbConnection from './setupDatabase';
import {ChattyServer} from './setupServer';
import { config } from './config';

class Application {
    public initialize(): void{
        this.loadConfig();
        dbConnection();
        const app: Express = express();
        const server: ChattyServer = new ChattyServer(app);
        server.start();
    }

    private loadConfig(): void {
        config.validateConfig();
    }
}

const application: Application = new Application();
application.initialize();