import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import expressPlayGround from 'graphql-playground-middleware-express';
import { readFileSync } from 'fs';
import resolvers from './resolvers';

const typeDefs = readFileSync('././typeDefs.graphql', 'utf8');

const app = express();
const server = new ApolloServer({ typeDefs, resolvers });
server.applyMiddleware({ app });

app.get('/', (req, res) => res.end('Welcome to the PhotoShare API'));
app.get('/playground', expressPlayGround({ endpoint: '/graphql' }));

app.listen({ port: 4000 }, () =>
  console.log(
    `GraphQL Server running @ http://localhost:4000${server.graphqlPath}`
  )
);
