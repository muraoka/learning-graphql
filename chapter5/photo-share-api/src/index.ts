import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import expressPlayGround from 'graphql-playground-middleware-express';
import { readFileSync } from 'fs';
import MongoClient from 'mongodb';
import dotenv from 'dotenv';
import resolvers from './resolvers';

dotenv.config();
const typeDefs = readFileSync('././typeDefs.graphql', 'utf8');

async function start() {
  const app = express();

  const MONGO_DB = process.env.DB_HOST;
  const client = await MongoClient.connect(MONGO_DB, { useNewUrlParser: true });
  const db = client.db();

  const context = { db };

  const server = new ApolloServer({ typeDefs, resolvers, context });

  server.applyMiddleware({ app });

  app.get('/', (req, res) => res.end('Welcome to the PhotoShare API'));
  app.get('/playground', expressPlayGround({ endpoint: '/graphql' }));

  app.listen({ port: 4000 }, () =>
    console.log(
      `GraphQL Server running @ http://localhost:4000${server.graphqlPath}`
    )
  );
}

start();
