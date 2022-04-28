// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createServer: createViteServer } = require('vite');
// Somehow didn't work if I just import above - some error when building.
import type { createServer, ViteDevServer } from 'vite';

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as url from 'url';
import connect from 'connect';

const DEV = process.env.NODE_ENV === 'development';

const config = {
    hostname: '0.0.0.0',
    port: DEV ? 3000 : 5000,
};

// TODO: reduce duplication with frontend.
function getApiUrl(hostname: string | undefined) {
    if (!hostname || hostname.indexOf('localhost') !== -1)
        return 'localhost:5050';
    if (hostname.indexOf('test') !== -1)
        return 'api.test.sltech.company';
    if (hostname.indexOf('sltech.company') !== -1 || hostname.indexOf('briq.construction') !== -1)
        return 'api.briq.construction';
}

async function runServer() {
    const app = connect();
    let vite: undefined | ViteDevServer;
    let template: string;
    // In dev mode, run vite as a dev server middleware so that the frontend can be loaded as if running 'npm run dev'
    if (DEV) {
        vite = await (createViteServer as typeof createServer)({
            mode: 'development',
            server: { middlewareMode: 'ssr' },
        });
        app.use(vite.middlewares);

        // Load the raw index.html, to be transformed.
        template = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');
    }
    // Load the transformed dist/index.html
    else
        template = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

    app.use(async (req: http.IncomingMessage, res) => {
        console.log('GET ', req.url);
        if (req.url === '/health') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('ok');
            return;
        }

        try {
            let processedTemplate = template;
            if (DEV)
                processedTemplate = await vite!.transformIndexHtml(req.url!, processedTemplate);

            if (req.url?.indexOf('/share') !== -1) {
                const url_parts = url.parse(req.url!, true);
                const setId = url_parts.query['set_id'];

                let data: any;
                try {
                    // Fetch information from the API.
                    // TODO: would perhaps be nice to not go throught the external router.
                    const apiUrl = getApiUrl(req.headers.host);
                    data = await new Promise((resolve, reject) => {
                        try {
                            const query = https.request(
                                {
                                    hostname: apiUrl,
                                    port: 443,
                                    method: 'GET',
                                    path: '/store_get/' + setId,
                                },
                                (resp) => {
                                    let data = '';

                                    // A chunk of data has been received.
                                    resp.on('data', (chunk) => {
                                        data += chunk;
                                    });

                                    // The whole response has been received. Print out the result.
                                    resp.on('end', () => {
                                        try {
                                            resolve(JSON.parse(data));
                                        } catch (err) {
                                            reject(err);
                                        }
                                    });

                                    resp.on('error', (err) => {
                                        reject(err);
                                    });
                                },
                            );
                            query.end();
                            query.on('error', (err) => {
                                reject(err);
                            });
                        } catch (err) {
                            reject(err);
                        }
                    });
                    processedTemplate = processedTemplate.replace(
                        '<!--<meta-replace>-->',
                        [
                            '<meta property="og:title" content="' + (data.data.name || data.data.id) + '">',
                            '<meta property="og:type" content="article" />',
                            '<meta property="og:description" content="Built with briqs">',
                            '<meta property="og:image" content="https://' + apiUrl + '/preview/' + setId + '.png">',
                            '<meta property="og:url" content="https://' + req.headers.host + req.url + '">',
                            '<meta name="twitter:card" content="summary_large_image">',
                        ].join('\n'),
                    );
                } catch (_) {
                    // Ignore error -> probably just a bad ID, will be handled by frontend.
                    // console.error(_);
                }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(processedTemplate);
        } catch (e: any) {
            // If an error is caught, let Vite fix the stracktrace so it maps back to
            // your actual source code.
            if (DEV && e instanceof Error)
vite!.ssrFixStacktrace(e);
            console.error(e);
            res.statusCode = 500;
            res.end(e?.message || e?.toString() || 'Unknown error');
        }
    });

    app.listen(config.port, config.hostname, async () => {
        console.log('Starting briq-builder Node server on ', config.port, config.hostname);
    });
}
runServer();
