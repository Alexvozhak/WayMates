import neo4j, { Driver } from "neo4j-driver";

type Credentials = {
  uri: string;
  user: string;
  password: string;
};

export async function createDriver(): Promise<Driver> {
  const { uri, user, password } = getCredentials();

  const config: neo4j.Config = {
    encrypted: false,
    disableLosslessIntegers: true,
  };

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), config);
  await driver.verifyAuthentication();
  return driver;
}

function getCredentials(): Credentials {
  const requiredEnvVars = ["NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD"];

  const missing = requiredEnvVars.filter((env) => !process.env[env]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return {
    uri: process.env.NEO4J_URI!,
    user: process.env.NEO4J_USER!,
    password: process.env.NEO4J_PASSWORD!,
  };
}
