import { NextResponse } from "next/server";
import { Resend } from "resend";

interface ContactRequestBody {
  name: string;
  email: string;
  message: string;
}

type ContactResponse = { ok: true } | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Partial<ContactRequestBody>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ContactResponse>(
      { ok: false, error: "Cuerpo de la solicitud inválido." },
      { status: 400 }
    );
  }

  const { name, email, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json<ContactResponse>(
      { ok: false, error: "Todos los campos son obligatorios." },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json<ContactResponse>(
      { ok: false, error: "El correo electrónico no tiene un formato válido." },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !toEmail) {
    return NextResponse.json<ContactResponse>(
      { ok: false, error: "El servicio de contacto no está configurado." },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Arcade Vault <onboarding@resend.dev>",
    to: toEmail,
    replyTo: email,
    subject: "Nuevo mensaje de contacto — Arcade Vault",
    text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
  });

  if (error) {
    return NextResponse.json<ContactResponse>(
      { ok: false, error: "No se pudo enviar el mensaje. Intentá de nuevo más tarde." },
      { status: 500 }
    );
  }

  return NextResponse.json<ContactResponse>({ ok: true });
}
