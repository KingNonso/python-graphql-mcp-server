import axios, { AxiosInstance } from "axios";
import { GraphQLResponse, IntrospectionResult } from "../types/graphql";

export interface GraphQLClient {
  endpoint: string;
  headers: Record<string, string>;

  introspect(): Promise<IntrospectionResult>;
  execute(query: string, variables?: any): Promise<GraphQLResponse>;
}

export class HttpGraphQLClient implements GraphQLClient {
  private client: AxiosInstance;

  constructor(
    public endpoint: string,
    public headers: Record<string, string> = {},
  ) {
    this.client = axios.create({
      baseURL: endpoint,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      timeout: 10000, // 10 second timeout
    });
  }

  async introspect(): Promise<IntrospectionResult> {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType { name }
          mutationType { name }
          subscriptionType { name }
          types {
            ...FullType
          }
          directives {
            name
            description
            locations
            args {
              ...InputValue
            }
          }
        }
      }

      fragment FullType on __Type {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          args {
            ...InputValue
          }
          type {
            ...TypeRef
          }
          isDeprecated
          deprecationReason
        }
        inputFields {
          ...InputValue
        }
        interfaces {
          ...TypeRef
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
        possibleTypes {
          ...TypeRef
        }
      }

      fragment InputValue on __InputValue {
        name
        description
        type { ...TypeRef }
        defaultValue
      }

      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.client.post("", {
      query: introspectionQuery,
    });

    return response.data;
  }

  async execute(query: string, variables?: any): Promise<GraphQLResponse> {
    const response = await this.client.post("", {
      query,
      variables,
    });

    return response.data;
  }
}
