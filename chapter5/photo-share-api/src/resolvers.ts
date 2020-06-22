import { GraphQLScalarType, Kind } from 'graphql';

const users = [
  { githubLogin: 'mHattrup', name: 'Mike Hattrup' },
  { githubLogin: 'gPlake', name: 'Glan Plake' },
  { githubLogin: 'sSchmidt', name: 'Scat Schmidt' },
];

const photos = [
  {
    id: '1',
    name: 'Dropping the Heart Chute',
    description: 'The heart chute is one of my favorite chutes',
    category: 'SELFIE',
    githubUser: 'gPlake',
    created: '3-28-1977',
  },
  {
    id: '2',
    name: 'Enjoying the sunshine',
    category: 'SELFIE',
    githubUser: 'sSchmidt',
    created: '1-2-1985',
  },
  {
    id: '3',
    name: 'Gunbarrel 25',
    description: '25 laps on gunbarrel today',
    category: 'LANDSCAPE',
    githubUser: 'sSchmidt',
    created: '2018-04-15T19:09:57.308Z',
  },
];

const tags = [
  { photoID: '1', userID: 'gPlake' },
  { photoID: '2', userID: 'sSchmidt' },
  { photoID: '2', userID: 'mHattrup' },
  { photoID: '2', userID: 'gPlake' },
];

const requestGithubToken = (credentials) =>
  fetch('http://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  })
    .then((res) => res.json())
    .catch((error) => {
      throw new Error(JSON.stringify(error));
    });

const requestGithubUserAccount = (token) =>
  fetch(`https://api.github.com/user?access_token=${token}`)
    .then((res) => res.json())
    .catch((error) => {
      throw new Error(JSON.stringify(error));
    });

async function authorizeWithGithub(credentials) {
  const { access_token } = await requestGithubToken(credentials);
  const githubUser = await requestGithubUserAccount(access_token);
  return { ...githubUser, access_token };
}

const resolvers = {
  Query: {
    me: (parent, args, { currentUser }) => currentUser,
    totalPhotos: (parent, args, { db }) =>
      db.collection('photos').estimatedDocumentCount(),
    allPhotos: (parent, args, { db }) =>
      db.collection('photos').find().toArray(),
    totalUsers: (parent, args, [db]) =>
      db.collection('users').estimatedDocumentCount(),
    allUsers: (parent, args, { db }) => db.collection('users').find().toArray(),
  },
  Mutation: {
    githubAuth: async (parent, { code }, { db }) => {
      const {
        message,
        access_token,
        avatar_url,
        login,
        name,
      } = await authorizeWithGithub({
        client_id: process.env.client_id,
        client_secret: process.env.client_secret,
        code,
      });
      if (message) {
        throw new Error(message);
      }
      const latestUserInfo = {
        name,
        githubLogin: login,
        githubToken: access_token,
        avatar: avatar_url,
      };
      const {
        ops: [user],
      } = await db
        .collection('users')
        .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true });
      return { user, token: access_token };
    },
    postPhoto: async (parent, args, { db, currentUser }) => {
      if (!currentUser) {
        throw new Error('only an authorized user can post a photo');
      }
      const newPhoto = {
        ...args.input,
        userID: currentUser.githubLogin,
        created: new Date(),
      };
      const { insertedIds } = await db.collection('photos').insert(newPhoto);
      newPhoto.id = insertedIds[0];

      return newPhoto;
    },
    addFakeUsers: async (root, { count }, { db }) => {
      const randomUserApi = `https://randomuser.me/api/?results=${count}`;
      const { results } = await (await fetch(randomUserApi)).json();
      const users = results.map((r) => ({
        githubLogin: r.login.username,
        name: `${r.name.first} ${r.name.last}`,
        avatar: r.picture.thumbnail,
        githubToken: r.login.sha1,
      }));
      await db.collection('users').insert(users);

      return users;
    },
    fakeUserAuth: async (parent, { githubLogin }, { db }) => {
      const user = await db.collection('users').findOne({ githubLogin });
      if (!user) {
        throw new Error(`Cannot find user with githubLogin ${githubLogin}`);
      }

      return {
        token: user.githubToken,
        user,
      };
    },
  },
  Photo: {
    id: (parent) => parent.id || parent._id,
    url: (parent) => `http://yoursite.com/img/${parent.id}.jpg`,
    postedBy: (parent, args, { db }) => {
      db.collection('users').findOne({ githubLogin: parent.userID });
    },
    taggedUsers: (parent) =>
      tags
        .filter((tag) => tag.photoID === parent.id)
        .map((tag) => tag.userID)
        .map((userID) => users.find((u) => u.githubLogin == userID)),
  },
  User: {
    postedPhotos: (parent) => {
      return photos.filter((p) => p.githubUser === parent.githubLogin);
    },
    inPhotos: (parent) =>
      tags
        .filter((tag) => tag.userID === parent.id)
        .map((tag) => tag.photoID)
        .map((photoID) => photos.find((p) => p.id === photoID)),
  },
  DateTime: new GraphQLScalarType({
    name: `DateTime`,
    description: 'A valid date time value',
    parseValue: (value) => new Date(value),
    serialize: (value) => new Date(value).toISOString(),
    parseLiteral: (ast) => {
      if (ast.kind === Kind.STRING) {
        return ast.value;
      }
    },
  }),
};

export default resolvers;
