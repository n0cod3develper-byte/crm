import * as msal from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let msalClient = null;

function getMsalClient() {
  if (msalClient) return msalClient;

  const msalConfig = {
    auth: {
      clientId: env.GRAPH_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${env.GRAPH_TENANT_ID}`,
      clientSecret: env.GRAPH_CLIENT_SECRET,
    },
    system: {
      loggerOptions: {
        loggerCallback(loglevel, message) {
          if (loglevel === msal.LogLevel.Error) {
            logger.error(`[MSAL] ${message}`);
          }
        },
        piiLoggingEnabled: false,
        logLevel: msal.LogLevel.Error,
      },
    },
  };

  msalClient = new msal.ConfidentialClientApplication(msalConfig);
  return msalClient;
}

export async function getGraphAccessToken() {
  const client = getMsalClient();
  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default'],
  };

  try {
    const authResponse = await client.acquireTokenByClientCredential(tokenRequest);
    return authResponse.accessToken;
  } catch (error) {
    logger.error('Error al obtener token de Graph API', { error: error.message });
    throw error;
  }
}

export function getGraphClient(accessToken) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}
