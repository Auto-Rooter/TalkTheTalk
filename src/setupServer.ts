import {Application, json, urlencoded, Response, Request, NextFunction} from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import cookieSession from 'cookie-session';
import HTTP_STATUS from 'http-status-codes';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import 'express-async-errors';
import {config} from './config';
import Logger from 'bunyan';
import applicationRoutes from './routes';
import { CustomError, IErrorResponse } from './shared/globals/helpers/error-handler';

const SERVER_PORT = 5000;
const log: Logger = config.createLogger('server');

export class ChattyServer {
    private app: Application;

    constructor(app: Application){
        this.app = app;
    }

    public start(): void {
        this.securityMiddleware(this.app);
        this.standardMiddleware(this.app);
        this.routesMiddleware(this.app);
        this.globalErrorHandler(this.app);
        this.startServer(this.app);
    }

    private securityMiddleware(app: Application): void {
        app.use(
            cookieSession({
                name: 'session', // we need this name when we setup the AWS Load Balancer
                keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
                maxAge: 24 * 7 * 3600000, // will expire in 7 days
                secure: config.NODE_ENV !== 'development' // staging, production
            })
        );
        app.use(hpp());
        app.use(helmet());
        app.use(
            cors({
                origin: config.CLIENT_URL,
                credentials: true, // it should be true if we want to use the cookie
                optionsSuccessStatus: 200, // for older browser like Iexplorer
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
            })
        );
    };
    private standardMiddleware(app: Application): void {
        app.use(compression());
        app.use(json({ limit: '50mb'})); // Max request size. if requestSize > 50mb through an error
        app.use(urlencoded({ extended: true, limit: '50mb'}));
    };
    private routesMiddleware(app: Application): void {
        applicationRoutes(app);
    };

    private globalErrorHandler(app: Application): void{
        // catch all error related to URLs not available
        app.all('*', (req: Request, res: Response) => {
            res.status(HTTP_STATUS.NOT_FOUND).json({message: `${req.originalUrl} not found.`});
        });

        // Custom errors
        app.use((error: IErrorResponse, req: Request, res: Response, next: NextFunction) => {
            log.error(error);
            if(error instanceof CustomError){
                res.status(error.statusCode).json(error.serializeError());
            }
            next(); // If there is no error
        });
    };

    private async startServer(app: Application): Promise<void>{
        try{
            const httpServer: http.Server = new http.Server(app);
            const socketIO: Server = await this.createSocketIO(httpServer);
            this.startHttpServer(httpServer);
            this.socketIOConnections(socketIO);
        } catch(err){
            log.error(err);
        }
    };
    // Socket.IO redis Adapter
    private async createSocketIO(httpServer: http.Server): Promise<Server>{
        const io: Server =  new Server(httpServer, {
            cors: {
                origin: config.CLIENT_URL,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
            }
        });
        const pubClient = createClient({url: config.REDIS_HOST}); // client for publishing/broadcasting
        const subClient = pubClient.duplicate(); // client for subscription
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        return io;
    };
    private startHttpServer(httpServer: http.Server): void{
        log.info(`Server has started with process ${process.pid}`);
        httpServer.listen(SERVER_PORT, () => {
            log.info(`[+] Server running on port ${SERVER_PORT}`); // Dont use console.log on Prod, use a lightweight lib like login
        });
    };
    // every socket.IO connection we going to create will be defined inside socketIOConnections method
    // run: sudo systemctl start redis-server
    private socketIOConnections(io: Server): void{

    }
}