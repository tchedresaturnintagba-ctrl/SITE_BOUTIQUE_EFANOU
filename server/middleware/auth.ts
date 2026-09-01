import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

type AdminToken = {
  sub: string
  email: string
  role: 'admin'
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Authentification administrateur requise.' })
    return
  }

  try {
    const token = authorization.slice('Bearer '.length)
    const payload = jwt.verify(token, config.JWT_SECRET) as AdminToken

    if (payload.role !== 'admin' || !payload.sub || !payload.email) {
      throw new Error('Jeton incomplet')
    }

    request.admin = { id: payload.sub, email: payload.email, role: payload.role }
    next()
  } catch {
    response.status(401).json({ message: 'Session invalide ou expirée.' })
  }
}