import { GraphQLClient } from "../utils/graphql-client";
import { IntrospectionResult } from "../types/graphql";

export class IntrospectionHandler {
  constructor(private client: GraphQLClient) {}

  async handle(): Promise<{
    schema: IntrospectionResult;
    types: string[];
    queries: string[];
    mutations: string[];
    subscriptions: string[];
  }> {
    try {
      const schema = await this.client.introspect();

      // Extract type names
      const types = schema.data.__schema.types
        .filter((type) => !type.name?.startsWith("__")) // Filter out introspection types
        .map((type) => type.name!)
        .filter(Boolean);

      // Extract query field names
      const queries =
        schema.data.__schema.queryType?.fields?.map((field) => field.name) ||
        [];

      // Extract mutation field names
      const mutations =
        schema.data.__schema.mutationType?.fields?.map((field) => field.name) ||
        [];

      // Extract subscription field names
      const subscriptions =
        schema.data.__schema.subscriptionType?.fields?.map(
          (field) => field.name,
        ) || [];

      return {
        schema,
        types,
        queries,
        mutations,
        subscriptions,
      };
    } catch (error) {
      throw new Error(
        `Failed to introspect GraphQL schema: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
