export function bad(req: { body: { shopId?: string } }) {
  return req.body.shopId;
}
