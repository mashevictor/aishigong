import jwt from "jsonwebtoken";

export function getJwtSecret(env) {
  const s = env.JWT_SECRET || "";
  if (!s || s.length < 16) {
    return null;
  }
  return s;
}

export function signUserToken(env, user) {
  const secret = getJwtSecret(env);
  if (!secret) {
    throw new Error("JWT_SECRET 未配置或过短（至少 16 字符）");
  }
  const expiresIn = env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(
    { uid: user.id, username: user.username, role: user.role, name: user.display_name },
    secret,
    { expiresIn }
  );
}

export function verifyUserToken(env, token) {
  const secret = getJwtSecret(env);
  if (!secret || !token) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function authMiddleware(env) {
  return function (req, res, next) {
    const h = req.headers.authorization || "";
    const m = /^Bearer\s+(.+)$/i.exec(h);
    const raw = m ? m[1].trim() : "";
    const payload = verifyUserToken(env, raw);
    if (!payload) {
      return res.status(401).json({ error: "未登录或令牌无效" });
    }
    req.user = payload;
    next();
  };
}
