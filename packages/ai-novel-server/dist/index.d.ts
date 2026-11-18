import http from 'node:http';

interface ServerFlags {
    rootDir: string;
    staticDir?: string;
    port: number;
    embeddedWorker?: boolean;
}
interface StandaloneNovelServer {
    server: http.Server;
    port: number;
    close: () => Promise<void>;
}
declare function startStandaloneNovelServer(options?: Partial<ServerFlags>): Promise<StandaloneNovelServer>;

export { startStandaloneNovelServer };
