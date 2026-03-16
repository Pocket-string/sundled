import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { env } from '@/lib/env'

// --- Validation schema ---

const contactSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  company: z.string().min(1, 'La empresa es requerida'),
  message: z.string().optional(),
})

type ContactInput = z.infer<typeof contactSchema>

// --- Simple in-memory rate limiter (max 3 per IP per hour) ---

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true
  }

  entry.count += 1
  return false
}

// --- Email HTML builder ---

function buildEmailHtml(data: ContactInput): string {
  const messageBlock = data.message
    ? `<tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Mensaje:</td>
        <td style="padding: 8px 0 8px 16px; color: #111827; font-size: 14px; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
      </tr>`
    : ''

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo contacto desde lucvia.com</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">
    <tr>
      <td style="background-color: #059669; padding: 24px 32px;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Nuevo contacto desde lucvia.com</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 24px; color: #374151; font-size: 15px;">
          Has recibido un nuevo mensaje de contacto. Aquí están los detalles:
        </p>
        <table cellpadding="0" cellspacing="0" style="width: 100%; border-top: 1px solid #e5e7eb;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Nombre:</td>
            <td style="padding: 8px 0 8px 16px; color: #111827; font-size: 14px; font-weight: 500;">${escapeHtml(data.name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
            <td style="padding: 8px 0 8px 16px; color: #111827; font-size: 14px;">
              <a href="mailto:${escapeHtml(data.email)}" style="color: #059669; text-decoration: none;">${escapeHtml(data.email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Empresa:</td>
            <td style="padding: 8px 0 8px 16px; color: #111827; font-size: 14px; font-weight: 500;">${escapeHtml(data.company)}</td>
          </tr>
          ${messageBlock}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          Este email fue generado automáticamente por lucvia.com. Responde directamente a este email para contactar al remitente.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// --- Route handler ---

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Por favor espera antes de intentarlo de nuevo.' },
        { status: 429 }
      )
    }

    // Validate input
    const body: unknown = await req.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check API key
    if (!env.RESEND_API_KEY) {
      console.error('[contact] RESEND_API_KEY not configured')
      return NextResponse.json(
        { error: 'El servicio de correo no está configurado.' },
        { status: 503 }
      )
    }

    // Send email
    const resend = new Resend(env.RESEND_API_KEY)

    const { error: sendError } = await resend.emails.send({
      from: 'Lucvia Web <onboarding@resend.dev>',
      to: 'jonathan.navarrete@usach.cl',
      replyTo: data.email,
      subject: `Nuevo contacto desde lucvia.com: ${data.company}`,
      html: buildEmailHtml(data),
    })

    if (sendError) {
      console.error('[contact] Resend error:', sendError)
      return NextResponse.json(
        { error: 'No se pudo enviar el mensaje. Por favor intenta más tarde.' },
        { status: 502 }
      )
    }

    console.info('[contact] Email sent from', data.email, 'company:', data.company)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contact] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
