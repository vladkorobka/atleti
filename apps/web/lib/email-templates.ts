// Email-safe HTML-шаблони для листів Atleti.
//
// Чому так: поштові клієнти (Gmail, Outlook, Apple Mail) ненадійно підтримують
// сучасний CSS, <style>-блоки часто вирізаються, а Tailwind-класи не працюють
// взагалі. Тому — table-based layout + inline-стилі, max-width ~520px, бренд
// текстом «Atleti» (без зовнішніх зображень, які можуть не завантажитись).
//
// Розширення: щоб додати новий кейс (запрошення тренера, нагадування тощо),
// напишіть тонку функцію-обгортку, яка формує { title, intro, ctaLabel,
// ctaUrl, footnote } і викликає renderEmail(...). Приклад — renderCoachInviteEmail.

export interface EmailContent {
  /** Заголовок листа (H1 у тілі). */
  title: string
  /** Один або кілька абзаців основного тексту (HTML вже екранований не потрібен — це наш контент). */
  intro: string | string[]
  /** Текст CTA-кнопки. Якщо відсутній — кнопка не показується. */
  ctaLabel?: string
  /** URL для CTA-кнопки. */
  ctaUrl?: string
  /** Дрібний пояснювальний текст під кнопкою (напр. термін дії посилання). */
  footnote?: string
}

// Брендова палітра (узгоджена із застосунком: акцент ~ bg-gray-900).
const COLORS = {
  bg: '#f3f4f6', // gray-100 — фон листа
  card: '#ffffff',
  border: '#e5e7eb', // gray-200
  text: '#111827', // gray-900
  muted: '#6b7280', // gray-500
  accent: '#111827', // gray-900 — кнопка/бренд
  accentText: '#ffffff',
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Мінімальне екранування для значень, що йдуть у HTML-атрибути (напр. URL).
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderParagraphs(intro: string | string[]): string {
  const items = Array.isArray(intro) ? intro : [intro]
  return items
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">${p}</p>`
    )
    .join('')
}

function renderButton(label: string, url: string): string {
  const href = escapeAttr(url)
  // Кнопка-посилання: padding на <a>, щоб клікабельною була вся площа.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
      <tr>
        <td align="center" bgcolor="${COLORS.accent}" style="border-radius:8px;">
          <a href="${href}" target="_blank"
             style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${COLORS.accentText};text-decoration:none;border-radius:8px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`
}

/**
 * Рендерить повний HTML-лист у брендовій обгортці Atleti.
 * Email-safe: table layout + inline-стилі, без зовнішніх ресурсів.
 */
export function renderEmail({ title, intro, ctaLabel, ctaUrl, footnote }: EmailContent): string {
  const cta = ctaLabel && ctaUrl ? renderButton(ctaLabel, ctaUrl) : ''
  const footnoteHtml = footnote
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${COLORS.muted};">${footnote}</p>`
    : ''

  // Фолбек-посилання текстом — на випадок, якщо кнопка не відрендериться.
  const plainLink =
    ctaUrl
      ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${COLORS.muted};word-break:break-all;">
           Якщо кнопка не працює, скопіюйте посилання у браузер:<br>
           <a href="${escapeAttr(ctaUrl)}" target="_blank" style="color:${COLORS.muted};">${escapeAttr(ctaUrl)}</a>
         </p>`
      : ''

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;">

          <!-- Бренд -->
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <span style="font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.accent};">Atleti</span>
            </td>
          </tr>

          <!-- Картка -->
          <tr>
            <td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;padding:32px;">
              <h1 style="margin:0 0 16px;font-family:${FONT};font-size:20px;font-weight:600;line-height:1.3;color:${COLORS.text};">${title}</h1>
              <div style="font-family:${FONT};">
                ${renderParagraphs(intro)}
                ${cta}
                ${footnoteHtml}
                ${plainLink}
              </div>
            </td>
          </tr>

          <!-- Футер -->
          <tr>
            <td align="center" style="padding:20px 0 0;">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLORS.muted};">
                Atleti — платформа для фітнес-тренерів та їх клієнтів.<br>
                Цей лист надіслано автоматично, відповідати на нього не потрібно.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Конкретні кейси ────────────────────────────────────────────────

/** Лист підтвердження email при реєстрації. */
export function renderVerificationEmail(verifyUrl: string): string {
  return renderEmail({
    title: 'Вітаємо в Atleti!',
    intro: 'Залишився останній крок — підтвердьте свою електронну пошту, щоб завершити реєстрацію.',
    ctaLabel: 'Підтвердити email',
    ctaUrl: verifyUrl,
    footnote:
      'Якщо ви не реєструвалися в Atleti — просто проігноруйте цей лист. Посилання дійсне 24 години.',
  })
}

/** Лист скидання паролю. */
export function renderPasswordResetEmail(resetUrl: string): string {
  return renderEmail({
    title: 'Скидання паролю',
    intro: 'Ви запросили скидання паролю для вашого акаунта Atleti. Натисніть кнопку нижче, щоб встановити новий пароль.',
    ctaLabel: 'Встановити новий пароль',
    ctaUrl: resetUrl,
    footnote:
      'Якщо це були не ви — проігноруйте цей лист, ваш пароль лишиться незмінним. Посилання дійсне 1 годину.',
  })
}

/**
 * Заготовка-приклад майбутнього кейсу: запрошення від тренера.
 * Поки не використовується — показує, як додавати нові листи.
 */
export function renderCoachInviteEmail(coachName: string, appUrl: string): string {
  return renderEmail({
    title: 'Вас запросили до Atleti',
    intro: [
      `Тренер <strong>${coachName}</strong> запросив вас приєднатися як клієнт.`,
      'Прийміть запрошення, щоб бронювати заняття та переглядати свій баланс.',
    ],
    ctaLabel: 'Переглянути запрошення',
    ctaUrl: appUrl,
    footnote: 'Якщо ви не очікували цього запрошення — просто проігноруйте лист.',
  })
}
