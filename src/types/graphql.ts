export interface GraphQLResponse {
  data?: any;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: Array<string | number>;
  extensions?: Record<string, any>;
}

export interface IntrospectionResult {
  data: {
    __schema: {
      types: GraphQLType[];
      queryType: GraphQLType;
      mutationType?: GraphQLType;
      subscriptionType?: GraphQLType;
    };
  };
}

export interface GraphQLType {
  kind: string;
  name?: string;
  description?: string;
  fields?: GraphQLField[];
  interfaces?: GraphQLNamedType[];
  possibleTypes?: GraphQLNamedType[];
  enumValues?: GraphQLEnumValue[];
  inputFields?: GraphQLInputValue[];
  ofType?: GraphQLType;
}

export interface GraphQLField {
  name: string;
  description?: string;
  args: GraphQLInputValue[];
  type: GraphQLType;
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface GraphQLNamedType {
  name: string;
}

export interface GraphQLEnumValue {
  name: string;
  description?: string;
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface GraphQLInputValue {
  name: string;
  description?: string;
  type: GraphQLType;
  defaultValue?: string;
}
