import * as node_http from 'node:http';

interface ServerFlags {
    rootDir: string;
    staticDir?: string;
    port: number;
    embeddedWorker?: boolean;
}
declare function startStandaloneNovelServer(options?: Partial<ServerFlags>): Promise<{
    server: node_http.Server<typeof node_http.IncomingMessage, typeof node_http.ServerResponse>;
    port: number;
    close: () => Promise<void>;
}>;

export { startStandaloneNovelServer };
