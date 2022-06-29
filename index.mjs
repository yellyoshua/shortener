/* global addEventListener, URLS, Response, AUTH_SECRET  */
const domain = 'https://short.yoshualopez.com/';
import HTML from './index.html';

const renderHTML = (allKeys = []) => {
  const data = allKeys.map(({hash, link}) => {
    const shortLink = domain+hash;
 
    return {hash, shortLink, link};
  });

  return HTML.replace('{{__DATA__}}', JSON.stringify(data));
};

/**
 * TODO:
 * - Hacer un frontend para todo esto
 * - Implementar el método PUT
 * - Poder sobreescribir en el POST si ya existe con un flag.
 */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const respondWith = ({ body = null, contentType = 'text/html', location, status = 200 }) => new Response(body,
  {
    status,
    headers:
      { Location: location, 'Content-Type': contentType }
  }
)

const handleGet = async ({ hash }) => {
  const location = await SHORTS.get(hash)

  return location
    ? respondWith({ status: 302, location })
    : respondWith({ status: 404 })
}

const handlePost = async ({ hash, headers }) => {
  hash = hash || Math.random().toString(36).slice(2, 10)

  const previousDestination = await SHORTS.get(hash)
  if (previousDestination) respondWith({ status: 409 })

  const destination = headers.get('x-destination')
  await SHORTS.put(hash, destination)
  return respondWith({ status: 201 })
}

const handleDelete = async ({ hash }) => {
  await SHORTS.delete(hash)
  return respondWith({ status: 204 })
}

const handleUpdate = async ({ hash, headers }) => {
  const previousDestination = await SHORTS.get(hash)
  if (!previousDestination) respondWith({ status: 401 })

  const destination = headers.get('x-destination')
  await SHORTS.put(hash, destination)
  return respondWith({ status: 201 })
}

const renderUI = async () => {
  const { keys, ...rest } = await SHORTS.list()

  const allKeys = await Promise.all(
    keys.map(async (key) => {
      const hash = key.name;
      const link = await SHORTS.get(hash)
      return { hash, link };
    })
  );

  const body = renderHTML(allKeys)

  return respondWith({ body })
}

const checkAuth = ({ auth }, callback) =>
  auth === AUTH_SECRET
    ? callback()
    : respondWith({ status: 401 })

/**
 * Respond to the request
 * @param {Request} request
 */
async function handleRequest (request) {
  const { headers, url, method } = request
  const auth = request.headers.get('Authorization')

  const { pathname } = new URL(url)
  const hash = pathname.slice(1) // transform "/pathname" to "pathname"

  if (method === 'GET') {
    return hash !== ''
      ? handleGet({ hash })
      : renderUI()
  }

  if (method === 'POST') {
    return checkAuth({ auth }, () => handlePost({ hash, headers }))
  }

  if (method === 'DELETE') {
    return checkAuth({ auth }, () => handleDelete({ hash }))
  }

  if (['PUT'].includes(method)) {
    return checkAuth({ auth }, () => handleUpdate({ hash, headers }))
  }

  return respondWith({ status: 405 })
}