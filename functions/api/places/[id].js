import { errorResponse, getConfig, verifyPin } from '../../_lib/api.js';

export async function onRequestDelete(context) {
  let config;
  try {
    config = getConfig(context.env);
  } catch (err) {
    return errorResponse(err.message, 500);
  }

  const auth = verifyPin(context.request, config.appPin);
  if (!auth.ok) return auth.response;

  const id = context.params?.id ? String(context.params.id).trim() : '';
  if (!id) {
    return errorResponse('Not found', 404);
  }

  try {
    const result = await config.db.prepare('DELETE FROM places WHERE id = ?1').bind(id).run();
    if (!result?.meta?.changes) {
      return errorResponse('Not found', 404);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[places] Failed to delete place from D1.', err);
    return errorResponse('Failed to delete place', 502);
  }
}
