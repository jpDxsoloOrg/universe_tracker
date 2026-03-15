export interface Environment {
  name: string;
  baseUrl: string;
  apiUrl: string;
}

const environments: Record<string, Environment> = {
  local: {
    name: 'local',
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3001/dev',
  },
  dev: {
    name: 'dev',
    baseUrl: 'https://universe.jpdxsolo.com',
    apiUrl: '<TBD after first deploy>',
  },
};

export function getEnvironment(): Environment {
  const envName = process.env.TEST_ENV || 'dev';
  return environments[envName] || environments.dev;
}

export { environments };
