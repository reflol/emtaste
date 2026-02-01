export async function onRequest(context) {
  const host = context.request.headers.get('host') || '';
  if (host.toLowerCase() === 'www.emtaste.com') {
    const url = new URL(context.request.url);
    url.host = 'emtaste.com';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
