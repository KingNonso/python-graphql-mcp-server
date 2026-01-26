import { GraphQLClient } from "../utils/graphql-client";
import { GraphQLResponse } from "../types/graphql";

export class QueryExecutionHandler {
  constructor(
    private client: GraphQLClient,
    private allowMutations: boolean = false,
  ) {}

  async handle(params: {
    query_string: string;
    variables?: Record<string, any>;
  }): Promise<GraphQLResponse> {
    const { query_string, variables } = params;

    try {
      // Basic validation - check if it's a mutation when mutations are disabled
      if (!this.allowMutations && this.isMutation(query_string)) {
        throw new Error(
          "Mutations are disabled. Set ALLOW_MUTATIONS=true to enable mutation execution.",
        );
      }

      // Execute the query
      const response = await this.client.execute(query_string, variables);
      return response;
    } catch (error) {
      // If it's a GraphQL error from the backend, preserve it
      if (error instanceof Error && error.message.includes("GraphQL")) {
        throw error;
      }

      // For other errors, wrap them appropriately
      throw new Error(
        `Failed to execute GraphQL query: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private isMutation(query: string): boolean {
    // Simple check for mutation keyword - this could be more sophisticated
    const trimmed = query.trim().toLowerCase();
    return trimmed.startsWith("mutation") || trimmed.includes("mutation {");
  }
}
