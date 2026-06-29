import { APP_NAME, APP_SHORT_NAME } from "../src/lib/constants.js";

export function buildOtpEmailHtml(otp: string, minutesValid: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_SHORT_NAME} Login Code</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${APP_NAME}</h1>
              <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;font-weight:600;">Secure Login</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">Your one-time verification code is:</p>
              <div style="margin:20px 0;padding:20px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;text-align:center;">
                <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1e293b;font-family:Consolas,monospace;">${otp}</span>
              </div>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">
                This code expires in <strong>${minutesValid} minutes</strong>. Do not share it with anyone.
              </p>
              <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
                If you did not request this code, you can safely ignore this email. For help, contact your IT administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">
                © ${new Date().getFullYear()} ${APP_NAME} • Enterprise Asset Tracking
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
