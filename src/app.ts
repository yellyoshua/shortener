import {Hono} from 'hono';
import {prettyJSON} from 'hono/pretty-json';
import {logger} from 'hono/logger';
import HTML from './index.html';

const domain = 'https://short.yoshualopez.com/';
type Bindings = {
  SHORTS: KVNamespace;
}

const app = new Hono<{Bindings: Bindings}>({});

app.use(prettyJSON());
app.use(logger());

app.use(async (c, next) => {
  if (c.req.method.toUpperCase() === 'GET' || c.req.method.toUpperCase() === 'HEAD' || c.req.method.toUpperCase() === 'OPTIONS') {
    return next();
  }

  const auth = c.req.header('Authorization');

  if (!auth || auth !== AUTH_SECRET) {
    return c.json({ok: false, message: 'Unauthorized'}, 401);
  }

  return next();
});

app.get('/:hash', async (c) => {
  const hash = c.req.param('hash');
  const location = await c.env.SHORTS.get(hash);

  return location
    ? c.redirect(location, 302)
    : c.json({ok: false, message: 'Short link not found'}, 404);
});

app.get('/', async (c) => {
  const {keys, ...rest} = await c.env.SHORTS.list();

  const data = await Promise.all(
    keys.map(async (key) => {
      const hash = key.name;
      const link = await c.env.SHORTS.get(hash);
      const shortLink = domain + hash;

      return {hash, shortLink, link};
    })
  );

  return c.html(HTML.replace('{{__DATA__}}', JSON.stringify(data)));
});

app.post('/:hash', async (c) => {
  const hash = c.req.param('hash') || Math.random().toString(36).slice(2, 10);
  const prevDestination = await c.env.SHORTS.get(hash);
  if (prevDestination) {
    return c.json({ok: false, message: 'Hash already exists'}, 409);
  }

  const {destination} = await c.req.json();

  await c.env.SHORTS.put(hash, destination);

  return c.json({ok: true, hash});
});

app.delete('/:hash', async (c) => {
  const hash = c.req.param('hash');
  await c.env.SHORTS.delete(hash);

  return c.json({ok: true});
});

app.put('/:hash', async (c) => {
  const hash = c.req.param('hash');
  const prevDestination = await c.env.SHORTS.get(hash);
  if (!prevDestination) {
    return c.json({ok: false, message: 'Hash does not exist'}, 404);
  }

  const {destination} = await c.req.json();
  await c.env.SHORTS.put(hash, destination);

  return c.json({ok: true, hash});
});

app.all('*', async (c) => {
  return c.redirect('/', 302);
});

export default app;
