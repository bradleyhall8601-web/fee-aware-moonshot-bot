import { ProxyAgent, setGlobalDispatcher } from 'undici';
import telemetryLogger from './telemetry';

export function configureRuntimeNetwork(): void {
  const proxyUrl = process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy;

  if (!proxyUrl) return;

  try {
    // Ensure node-fetch/http(s) clients (e.g., Telegraf internals) also honor proxy.
    process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.GLOBAL_AGENT_HTTP_PROXY || proxyUrl;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('global-agent/bootstrap');

    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    telemetryLogger.info('Configured runtime proxy for undici and node http clients from environment', 'runtime-network');
  } catch (err) {
    telemetryLogger.error('Failed to configure global fetch proxy dispatcher', 'runtime-network', err);
  }
}
