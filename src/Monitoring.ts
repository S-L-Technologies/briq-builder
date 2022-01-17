import type * as SentryType from '@sentry/vue';
var Sentry: typeof SentryType;

import { APP_ENV, DEV } from './Meta';

export async function setupMonitoring(app: any, router: any)
{
    // Turned off in prod for now.
    if (APP_ENV === "prod")
        return;
    if (APP_ENV === "dev")
        return;
    
    let sentryLib = await import('./sentry_wrapper');
    Sentry = sentryLib.Sentry;
    const Integrations = sentryLib.Integrations;

    // Init Sentry error tracking.
    Sentry.init({
        app,
        dsn: "https://906eb15ca7ee4507b4e8c19d36dad8df@o1101631.ingest.sentry.io/6127679",
        environment: APP_ENV,
        integrations: [
            new Integrations.BrowserTracing({
                routingInstrumentation: Sentry.vueRouterInstrumentation(router),
                tracingOrigins: ["localhost", "briq.construction","sltech.company", /^\//],
            }),
        ],
        // Still report vue errors in the console.
        logErrors: true,
        // Sample 5% of transactions for performance.
        tracesSampleRate: 0.05,
        // % of errors to report
        sampleRate: 1.0,
    });
}

/**
 * Manual exception reporting. Adds more info to the stack trace for easier tracking.
 * @param err Error to track
 * @param reason A richer reason for the error for easier reading in Sentry.
 */
export function reportError(err: Error, reason?: string)
{
    let richError = new Error();
    richError.name = err.name;
    richError.message = (reason ? `(${reason})\n` : "") + err.message;
    richError.stack += err?.stack ? "\n" + err?.stack : "";
    if (DEV)
        console.log("reporting error >> ", richError)
    Sentry?.captureException(richError);
}